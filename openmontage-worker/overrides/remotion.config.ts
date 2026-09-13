import {Config} from '@remotion/cli/config';

// Railway renders without outbound browser downloads. Use Debian's pinned
// Chromium package so Remotion is ready as soon as the worker starts.
Config.setBrowserExecutable(
  process.env.REMOTION_BROWSER_EXECUTABLE ?? '/usr/bin/chromium',
);
Config.setChromiumOpenGlRenderer('swangle');
