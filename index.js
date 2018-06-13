#!/usr/bin/env node

const net = require('net')
const prompt = require('prompt')

const port = 10008
const childrenPeers = []

function messageChildren(message, peer){
  childrenPeers.forEach(p => {
    if(p !== peer){
      p.write(message)
    }
  })
}

function connect(host){
  let peer

  function getMessage(){
    prompt.get('message', (err, {message}) => {
      if(peer){
        peer.write(message)
      }
      messageChildren(message, peer)
      getMessage()
    })
  }

  net.createServer((p) => {
    p.on('data', (data) => {
      if(peer){
        peer.write(data.toString())
      }
      messageChildren(data.toString(), p)
      console.log(data.toString())
    })

    childrenPeers.push(p)
  }).listen(port)

  if(host === 'null'){
    getMessage()
    return false
  }

  peer = net.createConnection(port, host, getMessage)

  peer.on('error', () => {
    console.log('retrying connection...')
    setTimeout(connect, 5000, host)
  })

  peer.on('data', (data) => {
    console.log(data.toString())
    messageChildren(data.toString(), peer)
  })
}

prompt.get('host', (err, {host}) => {
  connect(host)
})




// Known Hosts
// 192.168.0.113
// 192.168.0.115