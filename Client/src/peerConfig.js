import { Peer } from 'peerjs';

let peerInstance = null;

const createPeerConnection = () => {
    if (peerInstance) {
        if (!peerInstance.destroyed) {
            peerInstance.destroy();
        }
        peerInstance = null;
    }

    const peer = new Peer(undefined, {
        host: import.meta.env.VITE_PEER_HOST,
        port: parseInt(import.meta.env.VITE_PEER_PORT),
        path: '/peerjs',
        secure: import.meta.env.VITE_PEER_SECURE === 'true',
        debug: 3,
        config: {
            iceServers: [
             { urls: "stun:stun.l.google.com:19302" },

    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turns:openrelay.metered.ca:443",
      username: "openrelayproject",
      credential: "openrelayproject",
    }
  ]
}

    });

    peer.on('error', (error) => {
        console.error('PeerJS error:', error);
        if (error.type === 'network' || error.type === 'disconnected' || error.type === 'server-error') {
            console.log('Attempting to reconnect...');
            setTimeout(() => {
                if (!peer.destroyed) {
                    console.log('Reconnecting peer...');
                    peer.reconnect();
                }
            }, 2000);
        }
    });

    peer.on('disconnected', () => {
        console.log('Peer disconnected. Attempting to reconnect...');
        setTimeout(() => {
            if (!peer.destroyed) {
                peer.reconnect();
            }
        }, 2000);
    });

    peer.on('close', () => {
        console.log('Peer connection closed');
        peerInstance = null;
    });

    peer.on('open', (id) => {
        console.log('PeerJS connection opened with ID:', id);
    });

    peerInstance = peer;
    return peer;
};

const destroyPeerConnection = () => {
    if (peerInstance && !peerInstance.destroyed) {
        peerInstance.destroy();
    }
    peerInstance = null;
};

export { destroyPeerConnection };
export default createPeerConnection;