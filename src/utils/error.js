
// Used advice from https://stackoverflow.com/questions/1382107/whats-a-good-way-to-extend-error-in-javascript

function HttpError(code = 500, message = 'Internal server error', data = null) {
    this.name = 'HttpError';
    this.stack = (new Error()).stack;
    this.code = code;
    this.message = typeof message === 'string' ? message : JSON.stringify(message);
    this.data = data
}

HttpError.prototype = new Error;

module.exports = HttpError;