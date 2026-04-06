const noop = () => {};

class FakeSocket {
  on() { return this; }
  once() { return this; }
  write() {}
  destroy() {}
  end() {}
}

class FakeServer {
  on() { return this; }
  listen(opts, cb) { if (cb) cb(); return this; }
  close() {}
}

const TcpSocket = {
  createServer: (cb) => new FakeServer(),
  createConnection: (opts, cb) => {
    setTimeout(() => {
      if (cb) cb();
    }, 100);
    return new FakeSocket();
  },
};

export default TcpSocket;
