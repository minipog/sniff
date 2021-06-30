# sniff
A mod development tool for TERA Toolbox (https://github.com/tera-toolbox/tera-toolbox)

Logs incoming and outgoing packets.

Sample output:

    {
	    	name: S_NPC_LOCATION,
		hex: 2c00fe90338b030000800c006dbc2bc7329d8fc70040a14464693c0078612cc70c6a8fc70020a14400000000,
		data: { gameId: 3518437209115443n, loc: Vec3 { x: -43964.42578125, y: -73530.390625, z: 1290 }, w: 2.5866751035721625, speed: 60, dest: Vec3 { x: -44129.46875, y: -73428.09375, z: 1289 }, type: 0 },
		filter: 000,
		time: 1601572173348
	}

 Edit `ignoredPackets.json` if you wish to ignore packets that clutter the output file.
