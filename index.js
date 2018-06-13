#!/usr/bin/env node

const net = require('net')
const prompt = require('prompt')

const peers = []

function broadcast(message, sender){
  peers.forEach(p => {
    if(p === sender) return
    p.write(message)
  })
}

function requestMessage(){
  prompt.get('message', (err, result) => {
    if(err) return
    broadcast(result.message)
    requestMessage()
  })
}

function connect(port, host){
  if(!host){
    requestMessage()
    return false
  }

  const peer = net.createConnection(port, host, () => {
    peers.push(peer)
    requestMessage()
  })

  peer.on('data', (data) => {
    const message = data.toString()
    broadcast(message, peer)
    console.log(message)
  })

  peer.on('end', () => {
    peers.splice(peers.indexOf(peer), 1)
  })

  peer.on('error', () => {
    setTimeout(connect, 5000, port, host)
  })
}

const server = net.createServer((p) => {
  p.on('data', (data) => {
    const message = data.toString()
    broadcast(message, p)
    console.log(message)
  })

  p.on('end', () => {
    peers.splice(peers.indexOf(p), 1)
  })

  peers.push(p)
}).listen(process.argv[2] || 10008)

prompt.get(['host', 'port'], (err, result) => {
  if(err) return
  connect(result.port, result.host)
})

process.on('exit', () => {
  server.close()
})