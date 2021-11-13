
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const fs = require('fs');

module.exports = function(token, clientId, guildId){
	console.log(guildId);
	console.log(clientId);
	const commands = [];
	const rest = new REST({ version: '9' }).setToken(token);	
	const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

	for (const file of commandFiles) {
		const command = require(`./commands/${file}`);
		commands.push(command.data.toJSON());
	}

	rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands })
		.then(() => console.log('Successfully registered application commands.'))
		.catch(console.error);
};