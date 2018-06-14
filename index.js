#!/usr/bin/env node

const net = require('net')
const prompt = require('prompt')
const uuid = require('uuid/v1')

let peerTable = {}
const serverPort = process.argv[2] || 10008
const messages = {}
let username = 'anon'

function createPeer(peer){
  peer.on('data', (data) => {
    const req = data.toString()

    if(req.indexOf('#handshake') === 0){
      const parts = req.replace('#handshake', '').split('&&')
      const peerId = getPeerId(peer, parts[0])
      peerTable[peerId] = peer

      const res = Object.keys(peerTable).join(',')
      peer.write(`#returnPeerTable${peerId}&&${res}`)  
      return
    }

    if(req.indexOf('#returnPeerTable') === 0){
      const res = req.replace('#returnPeerTable', '').split('&&')
      const pId = res[0]
      const ips = res[1].split(',')

      console.log('peerTable', res[1])
      
      peerTable = ips.reduce((peerTable, id) => {
        if(!peerTable[id]){
          peerTable[id] = false
        }
        return peerTable
      }, peerTable)

      findPeers(peerTable, pId)
      return
    }

    if(req.indexOf('#message') === 0){
      const parts = req.replace('#message', '').split('&&')
      if(!messages[parts[0]]){
        messages[parts[0]] = parts[1]
        broadcast(parts[0], parts[1], peer)
        console.log(parts[1])
      }
    }
  })

  peer.on('end', () => {
    console.log('peer left')
  })
}

let searchIndex = 1
function findPeers(table, startPeerId){
  const keys = Object.keys(table)
  const startPeerIndex = keys.indexOf(startPeerId)
  while(searchIndex < keys.length){
    const index = (startPeerIndex + searchIndex) % keys.length
    console.log(keys[index])
    if(!table[keys[index]] && keys[index] !== startPeerId){
      const parts = keys[index].split('@')
      const peer = net.createConnection(parts[1], parts[0], () => {
        console.log('connected', keys[index])
        createPeer(peer)
      })

      peer.on('error', () => {
        console.log('failed', keys[index])
      })
    }
    searchIndex *= 2
  }
}

function getPeerId(peer, port){
  return `${peer.remoteAddress.replace(/^.*:/, '')}@${port}`
}

function broadcast(id, message, sender){
  Object.values(peerTable).forEach(peer => {
    if(!peer || peer === sender) return
    peer.write(`#message${id}&&${message}`)
  })
}

function initialPeerConnect(port, host){
  requestMessage()

  if(!host) return

  const peer = net.createConnection(port, host, () => {
    const peerId = getPeerId(peer, port)
    peerTable[peerId] = peer
    console.log('connected', peerId)
    createPeer(peer)
    peer.write(`#handshake${serverPort}`)
  })

  peer.on('error', () => {
    console.log('retrying connection to initial peer...')
    initialPeerConnect(port, host)
  })
}

function requestMessage(){
  prompt.get('message', (err, result) => {
    if(err) return
    broadcast(uuid(), `${username} : ${result.message}`)
    requestMessage()
  })
}

const server = net.createServer(createPeer).listen(serverPort)

process.on('exit', () => {
  server.close()
})

prompt.get(['host', 'port', 'name'], (err, result) => {
  if(err) return
  initialPeerConnect(result.port, result.host)
  username = result.name
})