const { join } = require('path');
const { inspect } = require('util');
const { existsSync, mkdirSync, createWriteStream } = require('fs');
const IGNORED_PACKETS = require('./ignoredPackets.json');
const LOG_DIRECTORY = join(__dirname, 'logs');

if (!existsSync(LOG_DIRECTORY)) mkdirSync(LOG_DIRECTORY);

exports.NetworkMod = function (mod) {
    const boolsToNumbers = (...bools) => bools.map(Number).join('');

    const getPacketName = (code) => mod.dispatch.protocolMap.code.get(code) || `UNMAPPED CODE ${code}`;

    const formatPacketData = (packetData) => JSON.stringify(packetData, null, 4).replace(/"/g, '');

    const parsePacketData = (code, data) => {
        try {
            return inspect(mod.dispatch.fromRaw(code, '*', data), {
                depth: null,
                breakLength: Infinity,
                compact: true,
            });
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

    let stream, hook;

    const startPacketLogging = () => {
        stream = createWriteStream(join(LOG_DIRECTORY, `ttb-${Date.now()}.log`), { highWaterMark: 1024 * 1024 });
        stream.write(`# ${mod.majorPatchVersion}.${mod.minorPatchVersion} (${mod.dispatch.protocolVersion})`);

        hook = mod.hook(
            '*',
            'raw',
            { order: Infinity, filter: { fake: null, silenced: null, modified: null } },
            (code, data) => {
                const packetData = getPacketData(code, data);
                if (IGNORED_PACKETS.includes(packetData.name)) return;

                stream.write(`\n\n${formatPacketData(packetData)}`);
            }
        );
    };

    const endPacketLogging = () => {
        try {
            mod.unhook(hook);
            stream.end();
        } catch (_) {}
    };

    let toggle = false;

    mod.command.add('log', () => {
        toggle = !toggle;
        if (toggle) startPacketLogging();
        else endPacketLogging();

        mod.command.message(`LOGGING: ${toggle ? 'ON' : 'OFF'}`);
    });

    this.destructor = () => endPacketLogging();
};
