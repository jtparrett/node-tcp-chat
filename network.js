const net = require('net')
const prompt = require('prompt')

let peerTable = {}
const serverPort = process.argv[2] || 10008

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
    peer.write(`#returnMessage${id}&&${message}`)
  })
}

function initialPeerConnect(port, host){
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

const server = net.createServer(createPeer).listen(serverPort)

process.on('exit', () => {
  server.close()
})

prompt.get(['host', 'port'], (err, result) => {
  if(err) return
  initialPeerConnect(result.port, result.host)
})