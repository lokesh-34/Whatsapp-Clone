// Voice recording utility using MediaRecorder API

export class VoiceRecorder {
  constructor() {
    this.mediaRecorder = null
    this.audioChunks = []
    this.isRecording = false
    this.startTime = null
    this.onStopCallback = null
    this.onErrorCallback = null
  }

  async startRecording(onStop, onError) {
    try {
      this.onStopCallback = onStop
      this.onErrorCallback = onError
      this.audioChunks = []
      this.startTime = Date.now()

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      this.mediaRecorder = new MediaRecorder(stream)

      this.mediaRecorder.ondataavailable = (event) => {
        this.audioChunks.push(event.data)
      }

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' })
        const duration = (Date.now() - this.startTime) / 1000
        this.convertBlobToBase64(audioBlob, duration)
        // Stop the stream
        stream.getTracks().forEach(track => track.stop())
      }

      this.mediaRecorder.start()
      this.isRecording = true
    } catch (error) {
      console.error('Error accessing microphone:', error)
      if (this.onErrorCallback) {
        this.onErrorCallback(error.message)
      }
    }
  }

  stopRecording() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop()
      this.isRecording = false
    }
  }

  convertBlobToBase64(blob, duration) {
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64data = reader.result
      if (this.onStopCallback) {
        this.onStopCallback({
          voiceData: base64data,
          voiceDuration: duration,
          blob: blob,
        })
      }
    }
    reader.readAsDataURL(blob)
  }

  isCurrentlyRecording() {
    return this.isRecording
  }

  getCurrentDuration() {
    if (!this.isRecording) return 0
    return ((Date.now() - this.startTime) / 1000).toFixed(1)
  }
}

export const voiceRecorder = new VoiceRecorder()
