const { promises: fs } = require('fs');
const { readdir, readFile, writeFile } = fs;

async function getFolders(path) {
	return (await readdir(path, { withFileTypes: true }))
		.filter((dirent) => dirent.isDirectory())
		.map((dirent) => dirent.name);
}

async function getMetaForFolder(folder) {
	return JSON.parse(await readFile(`${folder}/meta.json`, 'utf-8'));
}

async function run() {
	const examplesRootPath = 'src/examples';
	const groupDirs = await getFolders(examplesRootPath);
	const result = [];

	for (const groupDir of groupDirs) {
		const groupPath = `src/examples/${groupDir}`;

		const { title: groupTitle } = await getMetaForFolder(groupPath);
		const groupResult = {
			title: groupTitle,
			examples: []
		};
		result.push(groupResult);

		const exampleDirs = await getFolders(groupPath);

		for (const exampleDir of exampleDirs) {
			const examplesPath = `${groupPath}/${exampleDir}`;
			const { title: exampleTitle } = await getMetaForFolder(examplesPath);
			const exampleResult = {
				slug: exampleDir.replace(/^\d+-/, ''),
				title: exampleTitle,
				files: []
			};
			groupResult.examples.push(exampleResult);

			const fileNames = (await readdir(examplesPath))
				.filter((file) => file !== 'meta.json');

			for (const fileName of fileNames) {
				const file = await readFile(`${examplesPath}/${fileName}`, 'utf-8');
				const [name, type] = fileName.split('.');
				exampleResult.files.push({
					name,
					source: file,
					type
				});
			}
		}
	}

	const output = `export default ${JSON.stringify(result, null, 2)}`;

	await writeFile(`${examplesRootPath}/all.js`, output, 'utf-8');
}

run()
	.catch(err => console.error(err));
