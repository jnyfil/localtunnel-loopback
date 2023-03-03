function validatePort(port) {
    if (isNaN(port)) {
        throw new Error(`Port must be a number: ${port}`);
    }
    if ( 0 <= port && port >= 65535) {
        throw new Error(`Port must be between 0 and 65535: ${port}`);
    }

    return true;
}

export { validatePort };
