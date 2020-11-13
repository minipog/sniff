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
    const boolsToNumbers = (...bools) => bools.map(Number).join('');

    const getPacketName = (code) => mod.dispatch.protocolMap.code.get(code) || `UNMAPPED CODE ${code}`;

    const formatPacketData = (packetData) => JSON.stringify(packetData, null, 4).replace(/"/g, '');

    const parsePacketData = (code, data) => {
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

    let stream, hook, toggle;

    const startPacketLogging = () => {
        const {
            publisher,
            majorPatchVersion,
            minorPatchVersion,
            dispatch: { protocolVersion },
        } = mod;

        stream = createWriteStream(join(LOG.DIR, `ttb-${Date.now()}.log`), LOG.STREAM_OPTS);
        stream.write(`# ${publisher} ${majorPatchVersion}.${minorPatchVersion} (${protocolVersion})`);

        return mod.hook('*', 'raw', LOG.HOOK_OPTS, logPacketData);
    };

    const logPacketData = (code, data) => {
        const packetData = getPacketData(code, data);
        if (LOG.IGNORED_PACKETS.has(packetData.name)) return;

        stream.write(`\n\n${formatPacketData(packetData)}`);
    };

    const endPacketLogging = () => {
        try {
            mod.unhook(hook);
            stream.end();
        } catch (_) {}
    };

    mod.command.add('log', {
        $default() {
            toggle = !toggle;
            if (toggle) hook = startPacketLogging();
            else endPacketLogging();

            mod.command.message(`LOGGING: ${toggle ? 'ON' : 'OFF'}`);
        },
    });

    this.destructor = () => endPacketLogging();
};
