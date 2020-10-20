const { join } = require('path');
const { inspect } = require('util');
const { existsSync, mkdirSync, createWriteStream } = require('fs');

const LOG = Object.freeze({
    DIR: join(__dirname, 'logs'),
    IGNORED_PACKETS: new Set(require('./ignoredPackets')),
    STREAM_OPTS: { highWaterMark: 1024 * 1024 },
    INSPECT_OPTS: { depth: null, breakLength: Infinity, compact: true },
    HOOK_OPTS: { order: Infinity, filter: { fake: null, silenced: null, modified: null } },
});

if (!existsSync(LOG.DIR)) mkdirSync(LOG.DIR);

exports.NetworkMod = function (mod) {
    let hook = null;
    let enabled = false;
    let logStream = null;
    let packetParsing = true;

    const boolsToNumbers = (...bools) => bools.map(Number).join('');

    const getPacketName = (code) => mod.dispatch.protocolMap.code.get(code) || `UNMAPPED CODE ${code}`;

    const formatPacketData = (packetData) => JSON.stringify(packetData, null, 4).replace(/"/g, '');

    const parsePacketData = (code, data) => {
        if (!packetParsing) return;

        try {
            return inspect(mod.dispatch.fromRaw(code, '*', data), LOG.INSPECT_OPTS);
        } catch (err) {
            return { parseError: err.message };
        }
    };

    const getPacketData = (code, data) => ({
        name: getPacketName(code),
        hex: data.toString('hex'),
        data: parsePacketData(code, data),
        filter: boolsToNumbers(data.$fake, data.$silenced, data.$modified, !data.$fake),
        time: Date.now(),
    });

    const logPacketData = (code, data) => {
        const packetData = getPacketData(code, data);
        if (LOG.IGNORED_PACKETS.has(packetData.name)) return;

        logStream.write(`\n\n${formatPacketData(packetData)}`);
    };

    const startPacketLogging = () => {
        const {
            publisher,
            majorPatchVersion,
            minorPatchVersion,
            dispatch: { protocolVersion },
        } = mod;

        logStream = createWriteStream(join(LOG.DIR, `ttb-${Date.now()}.log`), LOG.STREAM_OPTS);
        logStream.write(`# ${publisher}-${majorPatchVersion}.${minorPatchVersion} PROTOCOL ${protocolVersion}`);

        return mod.hook('*', 'raw', LOG.HOOK_OPTS, logPacketData);
    };

    const endPacketLogging = () => {
        try {
            mod.unhook(hook);
            logStream.end();
        } catch (_) {}
    };

    mod.command.add('log', {
        $default() {
            enabled = !enabled;
            if (enabled) hook = startPacketLogging();
            else endPacketLogging();
            mod.command.message(`LOGGING: ${enabled ? 'ON' : 'OFF'} | PARSING: ${packetParsing ? 'ON' : 'OFF'}`);
        },
        parse() {
            packetParsing = !packetParsing;
            mod.command.message(`PARSING: ${packetParsing ? 'ON' : 'OFF'}`);
        },
    });

    this.destructor = () => endPacketLogging();
};
