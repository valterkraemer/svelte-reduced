import sirv from 'sirv';
import polka from 'polka';
import compression from 'compression';
import * as sapper from '@sapper/server';
import { createReadStream } from 'fs';


const { PORT, NODE_ENV } = process.env;
const dev = NODE_ENV === 'development';

polka() // You can also use Express
	.get('/repl/local/*', getFile)
	.use(
		compression({ threshold: 0 }),
		sirv('static', { dev }),
		sapper.middleware()
	)
	.listen(PORT, err => {
		if (err) console.log('error', err);
	});

function getFile(req, res) {

	const file = req.params.wild;

	if (process.env.NODE_ENV !== 'development' || file.includes('/.')) {
		res.writeHead(403);
		res.end();
		return;
	}

	createReadStream('../' + file)
		.on('error', () => {
			res.writeHead(403);
			res.end();
		})
		.pipe(res);

	res.writeHead(200, { 'Content-Type': 'text/javascript' });
}
