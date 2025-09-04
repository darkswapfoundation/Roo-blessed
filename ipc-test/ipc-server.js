import ipc from 'node-ipc';

ipc.config.id = 'world';
ipc.config.retry = 1500;
ipc.config.silent = true;

ipc.serve(
    '/tmp/roo-code-ipc.sock',
    () => {
        ipc.server.on(
            'connect',
            (socket) => {
                console.log('Client connected');
                ipc.server.emit(
                    socket,
                    'ack',
                    {
                        id: ipc.config.id,
                        message: 'Hello from server'
                    }
                );
            }
        );

        ipc.server.on(
            'message',
            (data, socket) => {
                console.log('received message:', data);
                console.log('from client:', socket.id);
            }
        );
    }
);

console.log('IPC server started');
ipc.server.start();