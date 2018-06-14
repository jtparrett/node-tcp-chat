#!/usr/bin/env node

const net = require('net')
const prompt = require('prompt')
const uuid = require('uuid/v1')

const peers = []
let ipTable = {}
const messages = {}

function createPeer(peer){
  ipTable[peer.remoteAddress] = {
    host: peer.remoteAddress,
    port: peer.remotePort
  }

  peers.push(peer)

  peer.on('data', (data) => {
    const message = data.toString()

    if(message.indexOf('#ipTable') === 0){
      peer.write(`#returnIpTable${peer.remoteAddress}&&${JSON.stringify(ipTable)}`)  
      return
    }

    if(message.indexOf('#returnIpTable') === 0){
      const res = message.replace('#returnIpTable', '').split('&&')
      ipTable = JSON.parse(res[1])
      const keys = Object.keys(ipTable)
      const start = keys.indexOf(res[0])
      let index = 1

      console.log('received ipTable', res[1])

      while(index < keys.length){
        const cur = (start + index) % keys.length
        const ip = keys[cur]
        if(ip !== peer.remoteAddress && ip !== res[0]){
          const p = net.createConnection(ipTable[ip], () => {
            console.log('connected to peer', ip)
            createPeer(p)
          })
          index *= 2
        }
      }
    }

    if(message.indexOf('#returnMessage') === 0){
      const res = message.replace('#returnMessage', '').split('&&')
      if(!messages[res[0]]){
        messages[res[0]] = res[1]
        broadcast(res[0], res[1], peer)
        console.log(res[1])
      }
    }
  })

  peer.on('end', () => {
    delete ipTable[peer.remoteAddress]
    peers.splice(peers.indexOf(peer), 1)
  })
}

function connectDistancePeers(...ignorePeers){

}

function broadcast(id, message, sender){
  peers.forEach(p => {
    if(p === sender) return
    p.write(`#returnMessage${id}&&${message}`)
  })
}

function requestMessage(){
  prompt.get('message', (err, result) => {
    if(err) return
    broadcast(uuid(), result.message)
    requestMessage()
  })
}

function connect(port, host){
  if(!host){
    requestMessage()
    return
  }

  const peer = net.createConnection(port, host)

  peer.on('connect', () => {
    createPeer(peer)
    requestMessage()
    peer.write('#ipTable')
  })

  peer.on('error', () => {
    console.log('retrying connection...')
    connect(port, host)
  })
}

const server = net.createServer(createPeer).listen(process.argv[2] || 10008)

process.on('exit', () => {
  server.close()
})

prompt.get(['host', 'port'], (err, result) => {
  if(err) return
  connect(result.port, result.host)
})