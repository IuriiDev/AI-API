require('dotenv').config();

const { randomUUID } = require('crypto');
const express = require('express');
const cors = require('cors');
const path = require('path');

const config = require('./config');
const routes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

function createApp() {
    const app = express();
    app.disable('x-powered-by');
    app.set('trust proxy', config.server.trustProxy);
    app.use(cors({
        origin: config.cors.origins,
        credentials: config.cors.credentials,
        methods: ['GET', 'POST', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization']
    }));
    app.use(express.json({ limit: config.server.bodyLimit }));
    app.use(express.static(path.join(__dirname, 'public')));
    app.use((request, _response, next) => {
        request.requestId = randomUUID();
        if (process.env.NODE_ENV !== 'production') {
            console.log(
                `[${new Date().toISOString()}] ${request.requestId} `
                + `${request.method} ${request.path}`
            );
        }
        next();
    });

    app.use('/api', routes);
    app.get('/', (_request, response) => {
        response.sendFile(path.join(__dirname, 'public', 'index.html'));
    });
    app.use(notFoundHandler);
    app.use(errorHandler);
    return app;
}

function startServer(application = createApp()) {
    const server = application.listen(config.server.port, () => {
        console.log(
            `AI API Gateway listening on port ${config.server.port} `
            + `(${process.env.NODE_ENV || 'development'}).`
        );
    });

    const shutdown = (signal) => {
        console.log(`${signal} received. Closing HTTP server.`);
        server.close((error) => {
            if (error) {
                console.error(`HTTP server shutdown failed: ${error.message}`);
                process.exitCode = 1;
            }
        });
    };
    process.once('SIGTERM', () => shutdown('SIGTERM'));
    process.once('SIGINT', () => shutdown('SIGINT'));
    return server;
}

const app = createApp();

if (require.main === module) {
    startServer(app);
}

module.exports = app;
module.exports.createApp = createApp;
module.exports.startServer = startServer;
