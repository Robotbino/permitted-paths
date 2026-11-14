// Level 3. No test is permitted to reach the network. A request to a host that is not this
// computer fails immediately, thus a test can never call the real model or spend money.
import { beforeAll } from 'vitest';

beforeAll(() => {
  const real = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    if (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') throw new Error('A test tried to reach ' + url.hostname + '. Tests do not use the network.');
    return real(input, init);
  };
});
