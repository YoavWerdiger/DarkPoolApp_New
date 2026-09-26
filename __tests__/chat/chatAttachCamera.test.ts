import { readFileSync } from 'fs';
import { join } from 'path';

const cameraSrc = readFileSync(
  join(__dirname, '../../components/chat/ChatAttachCameraSheet.tsx'),
  'utf8',
);

describe('ChatAttachCameraSheet', () => {
  it('uses full-screen camera with shutter and flip controls', () => {
    expect(cameraSrc).toContain('CameraView');
    expect(cameraSrc).toContain('takePictureAsync');
    expect(cameraSrc).toContain('camera-reverse-outline');
    expect(cameraSrc).toContain('presentationStyle="fullScreen"');
  });
});
