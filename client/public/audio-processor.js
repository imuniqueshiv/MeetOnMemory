class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // 4096 samples at 16kHz is ~256ms of audio
    this.bufferSize = 4096;
    this.buffer = new Float32Array(this.bufferSize);
    this.bytesWritten = 0;
  }

  // eslint-disable-next-line no-unused-vars
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const inputChannel = input[0];
    for (let i = 0; i < inputChannel.length; i++) {
      this.buffer[this.bytesWritten++] = inputChannel[i];

      if (this.bytesWritten >= this.bufferSize) {
        this.flush();
      }
    }

    return true;
  }

  flush() {
    // Convert Float32 to Int16 PCM
    const pcmData = new Int16Array(this.bufferSize);
    for (let i = 0; i < this.bufferSize; i++) {
      // Clamp values to [-1, 1] before multiplying by 32767
      const s = Math.max(-1, Math.min(1, this.buffer[i]));
      pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }

    // Send the Int16 buffer back to the main thread
    this.port.postMessage(pcmData.buffer, [pcmData.buffer]);

    // Reset buffer
    this.buffer = new Float32Array(this.bufferSize);
    this.bytesWritten = 0;
  }
}

registerProcessor("audio-processor", AudioProcessor);
