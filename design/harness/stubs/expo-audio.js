const recorder = { record() {}, stop: async () => {}, prepareToRecordAsync: async () => {}, uri: null, isRecording: false, getStatus: () => ({ isRecording: false, durationMillis: 0, metering: -160 }) };
const player = { play() {}, pause() {}, seekTo: async () => {}, remove() {}, replace() {}, playing: false, currentTime: 0, duration: 0 };
module.exports = {
  useAudioRecorder: () => recorder, useAudioRecorderState: () => ({ isRecording: false, durationMillis: 0, metering: -160, canRecord: true }),
  useAudioPlayer: () => player, useAudioPlayerStatus: () => ({ playing: false, currentTime: 0, duration: 0, isLoaded: true }),
  createAudioPlayer: () => player, setAudioModeAsync: async () => {},
  requestRecordingPermissionsAsync: async () => ({ granted: true, status: 'granted' }),
  getRecordingPermissionsAsync: async () => ({ granted: true, status: 'granted' }),
  AudioModule: { requestRecordingPermissionsAsync: async () => ({ granted: true }) },
  RecordingPresets: { HIGH_QUALITY: {}, LOW_QUALITY: {} },
};
