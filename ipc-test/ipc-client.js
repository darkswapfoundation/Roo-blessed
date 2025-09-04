import ipc from 'node-ipc';

ipc.config.id = 'hello';
ipc.config.retry = 1500;
ipc.config.silent = true;

ipc.connectTo(
    'world',
    '/tmp/roo-code-ipc.sock',
    () => {
        ipc.of.world.on(
            'connect',
            () => {
                console.log('Connected to server');
                ipc.of.world.emit(
                    'message',
                    {
                        id: ipc.config.id,
                        message: 'Hello from client'
                    }
                )
            }
        );

        ipc.of.world.on(
            'disconnect',
            () => {
                console.log('Disconnected from server');
            }
        );

        ipc.of.world.on(
            'ack',
            (data) => {
                console.log('received ack:', data);
            }
        );
    }
);