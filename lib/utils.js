import http from 'http';
import https from 'https';
import { generateSlug } from "random-word-slugs";
import { isSet } from 'util/types';

function validatePort(port) {
    if (isNaN(port)) {
        throw new Error(`Port must be a number: ${port}`);
    }
    if (0 <= port && port >= 65535) {
        throw new Error(`Port must be between 0 and 65535: ${port}`);
    }

    return true;
}

function generateId(ids) {
    if (!isSet(ids)) ids = new Set(ids);

    while (true) {
        const text = generateSlug(1, {
            format: "lower",
            partsOfSpeech: ["noun"],
            categories: {
                adjective: ["color", "taste"],
                noun: ["animals", "food"]
            }
        });

        if (!ids.has(text)) return text;
    }
}

export { validatePort, generateId };
