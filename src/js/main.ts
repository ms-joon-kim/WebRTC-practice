'use strict';
interface Offer_Options {
  offerToReceiveAudio: any;
  offerToReceiveVideo: any;
}

interface MediaStream {
  audio: boolean;
  peerIdentity: string;
  video: boolean;
}

const startButton = document.getElementById('startButton') as HTMLButtonElement;
const callButton = document.getElementById('callButton') as HTMLButtonElement;
const hangupButton = document.getElementById('hangupButton') as HTMLButtonElement;
callButton.disabled = true;
hangupButton.disabled = true;
startButton.addEventListener('click', start);
callButton.addEventListener('click', call);
hangupButton.addEventListener('click', hangup);

let startTime: number;
const localVideo = document.getElementById('localVideo') as HTMLVideoElement;
const remoteVideo = document.getElementById('remoteVideo') as HTMLVideoElement;

localVideo.addEventListener('loadedmetadata', function () {
  console.log(`Local video videoWidth: ${this.videoWidth}px, videoHeight: ${this.videoHeight}px`);
});

remoteVideo.addEventListener('loadedmetadata', function () {
  console.log(`Remote video videoWidth: ${this.videoWidth}px,  videoHeight: ${this.videoHeight}px`);
});

remoteVideo.addEventListener('resize', () => {
  console.log(`Remote video size changed to ${remoteVideo.videoWidth}x${remoteVideo.videoHeight}`);
  if (startTime) {
    const elapsedTime: number = window.performance.now() - startTime;
    console.log(`Setup time: ${elapsedTime.toFixed(3)}ms`);
    startTime = NaN; // 기존 코드는 null
  }
});

let localstream: MediaStream;
let pc1: RTCPeerConnection;
let pc2: RTCPeerConnection;
const offerOptions: Offer_Options = {
  offerToReceiveAudio: 1,
  offerToReceiveVideo: 1
};

const getName = (pc: object): string => (pc === pc1) ? 'pc1' : 'pc2';

const getOtherPc = (pc: object) => (pc === pc1) ? pc2 : pc1;

async function start() {
  console.log('Requesting local stream');
  startButton.disabled = true;
  try {
    // 브라우저에 마이크와 카메라 사용 권한 요청
    const stream: MediaStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    console.log('Receive local stream');
    localVideo.srcObject = stream;
    localstream = stream;
    console.log(stream);
    callButton.disabled = false;
  } catch (e) {
    alert(`getUserMedia() error: ${e.name}`);
    startButton.disabled = false;
  }
};

async function call() {
  callButton.disabled = true;
  hangupButton.disabled = false;
  console.log('Starting call');
  startTime = window.performance.now();
  const videoTracks: Array<any> = localstream.getVideoTracks();
  const audioTracks: Array<any> = localstream.getAudioTracks();
  if (videoTracks.length > 0) {
    console.log(`Using video device: ${videoTracks[0].label}`);
  }
  if (audioTracks.length > 0) {
    console.log(`Using audio device: ${audioTracks[0].label}`);
  }
  const configuration: RTCConfiguration | undefined = {};
  console.log('RTCPeerConnection configuration:', configuration);
  pc1 = new RTCPeerConnection(configuration);
  console.log('Create local peer connection object pc1');
  pc1.addEventListener('icecandidate', (e) => onIceCandidate(pc1, e));
  pc2 = new RTCPeerConnection(configuration);
  console.log('Created remote peer connection object pc2');
  pc2.addEventListener('icecandidate', (e) => onIceCandidate(pc2, e));
  pc1.addEventListener('iceconnectionstatechange', (e) => onIceStateChange(pc1, e));
  pc2.addEventListener('iceconnectionstatechange', (e) => onIceStateChange(pc2, e));
  pc2.addEventListener('track', gotRemoteStream);

  localstream.getTracks().forEach((track: any) => pc1.addTrack(track, localstream));
  console.log('Added local stream to pc1');

  try {
    console.log('pc1 createOffer start');
    const offer = await pc1.createOffer(offerOptions);
    await onCreateOfferSuccess(offer);
  } catch (e) {
    onCreateSessionDescriptionError(e);
  }
};

const onCreateSessionDescriptionError = (error: any) => { console.log(`Failed to create session description: ${error.toString()}`); };

const onCreateOfferSuccess = async (desc: any): Promise<void> => {
  console.log(`Offer from pc1\n${desc.sdp}`);
  console.log('pc1 setLocalDescription start');
  try {
    await pc1.setLocalDescription(desc);
    onSetLocalSuccess(pc1);
  } catch (e) {
    onSetSessionDescriptionError(e);
  }

  console.log('pc2 setremoteDescription start');
  try {
    await pc2.setRemoteDescription(desc);
    onSetRemoteSuccess(pc2);
  } catch (e) {
    onSetSessionDescriptionError(e);
  }

  console.log('pc2 createAnswer start');
  try {
    const answer = await pc2.createAnswer();
    await onCreateAnswerSuccess(answer);
  } catch (e) {
    onCreateSessionDescriptionError(e);
  }
};

const onSetLocalSuccess = (pc: any) => { console.log(`${getName(pc)} setLocalDescription complete`); };

const onSetRemoteSuccess = (pc: any) => { console.log(`${getName(pc)} setRemoteDescription complete`); };

const onSetSessionDescriptionError = (error: Error) => { console.log(`Failed to set session description: ${error.toString()}`); };

const gotRemoteStream = (e: any) => {
  if (remoteVideo.srcObject !== e.streams[0]) {
    remoteVideo.srcObject = e.streams[0];
    console.log('pc2 received remote stream');
  }
};

const onCreateAnswerSuccess = async (desc: any): Promise<void> => {
  console.log(`Answer from pc2:\n${desc.sdp}`);
  console.log('pc2 setLocalDescription start');
  try {
    await pc2.setLocalDescription(desc);
    onSetLocalSuccess(pc2);
  } catch (e) {
    onSetSessionDescriptionError(e);
  }
  console.log('pc1 setRemoteDescription start');
  try {
    await pc1.setRemoteDescription(desc);
    onSetRemoteSuccess(pc1);
  } catch (e) {
    onSetSessionDescriptionError(e);
  }
};

const onIceCandidate = async (pc: any, event: any): Promise<void> => {
  try {
    await (getOtherPc(pc).addIceCandidate(event.candidate));
    onAddIceCandidateSuccess(pc);
  } catch (e) {
    onAddIceCandidateError(pc, e);
  }
  console.log(`${getName(pc)} ICE candidate:\n${event.candidate ? event.candidate.candidate : '(null)'}`);
};

const onAddIceCandidateSuccess = (pc: any) => { console.log(`${getName(pc)} addIceCandidate success`); };

const onAddIceCandidateError = (pc: any, error: Error) => { console.log(`${getName(pc)} failed to add ICE Candidate: ${error}`); };

const onIceStateChange = (pc: any, event: any) => {
  if (pc) {
    console.log(`${getName(pc)} ICE state: ${pc.iceConnectionState}`);
    console.log('ICE state change event: ', event);
  }
};

function hangup() {
  console.log('Ending call');
  pc1.close();
  pc2.close();
  // pc1 = null;
  // pc2 = null;
  hangupButton.disabled = true;
  callButton.disabled = false;
};
