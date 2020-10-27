class CompileError extends Error {
	code: string;
	filename: string;
	frame: string;

	toString() {
		return this.message;
	}
}

export default function error(message: string, props: {
	name: string;
	code: string;
	filename: string;
}): never {
	const error = new CompileError(message);
	error.name = props.name;

	error.code = props.code;
	error.filename = props.filename;

	throw error;
}
