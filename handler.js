const { createServer } = require('http');
const { parse } = require('url');
const { httpCompat } = require('./compat');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = 3000;
const app = next({ dev });
const handle = app.getRequestHandler();

const initHandler = async () => await app.prepare();

const handleRequest = async (req, res) => {
    try {
        const parsedUrl = parse(req.url, true)

        await handle(req, res, parsedUrl)
    } catch (err) {
        console.error('Error occurred handling', req.url, err)
        res.statusCode = 500
        res.end('internal server error')
    }
};

const handler = async (event) => {
    const { req, res, responsePromise } = httpCompat(event);
    await handleRequest(req, res);
    await responsePromise();
}

exports.handler = handler;

if (dev) {
    initHandler().then(() => createServer(handleRequest).listen(port, (err) => {
        if (err) throw err
        console.log(`> Ready on http://${hostname}:${port}`)
    }));
}
