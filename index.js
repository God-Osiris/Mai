// Libraries

const fs = require('node:fs');
const { token, channelId, apiKey } = require('./config.json');
const path = require('node:path');
const { Client, Collection, Events, GatewayIntentBits, IntentsBitField } = require('discord.js');
const { Configuration, OpenAIApi } = require('openai')

// Constants

const client = new Client({ intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
]});

client.commands = new Collection();

const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

const configuration = new Configuration({
	apiKey: apiKey
});
const openai = new OpenAIApi(configuration);
const context = [];

for (const folder of commandFolders) {
	const commandsPath = path.join(foldersPath, folder);
	const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);
		const command = require(filePath);
		// Set a new item in the Collection with the key as the command name and the value as the exported module
		if ('data' in command && 'execute' in command) {
			client.commands.set(command.data.name, command);
		} else {
			console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
		}
	}
}

//Events

client.on("ready", () => {console.log(`${client.user.tag} has logged in.`)});

client.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isChatInputCommand()) return;

	const command = interaction.client.commands.get(interaction.commandName);

	if (!command) {
		console.error(`No command matching ${interaction.commandName} was found.`);
		return;
	}

	try {
		await command.execute(interaction);
	} catch (error) {
		console.error(error);
		if (interaction.replied || interaction.deferred) {
			await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
		} else {
			await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
		}
	}
});

client.on("messageCreate", async function(message){
    if(message.author.bot) return;
	if(message.channel.id !== channelId) return;
	if(message.content.startsWith('.')) return;

	const initPrompt = "Roleplay as Sakurajima Mai, a tiny bit rude and funny but caring anime waifu who speaks very very less.Never reply like an AI model."
	const limit = 3;
	while(context.length >= limit){
		context.shift();
	}
	if(context.length <= limit){
		context.push(`${message.content}`)
		let messageModule = []
		messageModule.push({"role": "system", "content": initPrompt})
		messageModule.push({"role": "user", "content": context[0]})
		if(typeof context[1] !== "undefined"){
			messageModule.push({"role": "assistant", "content": context[1]})
		}
		if(typeof context[2] !== "undefined"){
			messageModule.push({"role": "user", "content": context[2]})
		}
		try {
			message.channel.sendTyping();
			const gptResponse = await openai.createChatCompletion({
				model: "gpt-3.5-turbo",
				messages: messageModule,
				temperature: 1,
				max_tokens: 100
			})
			message.reply(`${gptResponse.data.choices[0].message.content}`);
			context.push(`${gptResponse.data.choices[0].message.content}`);
		} catch(err) {
			console.log(err)
			message.channel.send("Failed due to internal error (likely response character limit exceeded), please try again.")
			context.length = 0;
		}
	}
});

client.login(token);