const { SlashCommandBuilder } = require('discord.js');
const { convert } = require('html-to-text');
const s_options = {
	wordwrap: null
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('find')
		.setDescription('Finds anime on AniList!')
        .addStringOption(option => 
            option.setName('input')
                .setDescription('The name of the anime you want to lookup.'))
        .addBooleanOption(option =>
            option.setName('hidden')
                .setDescription('Whether or not the response should be hidden to other users.')),
	async execute(interaction) {
		const anime = interaction.options.getString('input');
		const ephemeral = interaction.options.getBoolean('hidden') ?? false;
		
		// Here we define our query as a multi-line string
		// Storing it in a separate .graphql/.gql file is also possible
		var query = `
		query ($search: String) { # Define which variables will be used in the query
		Media (search: $search, type: ANIME) { # Insert our variables into the query arguments (type: ANIME is hard-coded in the query)
			id
			title {
				romaji
				english
				native
			}
			description
			seasonYear
			format
			status
			episodes
			isAdult
			genres
			tags {
				name
			}
			averageScore
			airingSchedule {
				edges {
					node {
						episode
						timeUntilAiring
					}
				}
			}
			coverImage {
				medium
				large
				extraLarge
				color
			}
		}
		}
		`;

		// Define our query variables and values that will be used in the query request
		var variables = {
			search: anime
		};

		// Define the config we'll need for our Api request
		var url = 'https://graphql.anilist.co',
			options = {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Accept': 'application/json',
				},
				body: JSON.stringify({
					query: query,
					variables: variables
				})
			};

		// Make the HTTP Api request
		fetch(url, options).then(handleResponse)
						.then(handleData)
						.catch(handleError);

		function handleResponse(response) {
			return response.json().then(function (json) {
				return response.ok ? json : Promise.reject(json);
			});
		}

		async function handleData(data) {
			const output = data;
			// here we build the embed
			const animeEmbed = {
				color: 0,
				title: `${output.data.Media.title.native} (${output.data.Media.seasonYear.toString()})`,
				url: `https://anilist.co/anime/${output.data.Media.id.toString()}/`,
				description: `**${output.data.Media.format} - ${output.data.Media.status}**`,
				thumbnail: {
					url: output.data.Media.coverImage.medium,
				},
				fields: [
					{
						name: 'Description:',
						value: convert(output.data.Media.description, s_options),
					},
					{
						name: 'Information:',
						value: `- 18+? ${output.data.Media.isAdult.toString()}\n- Episodes: ${output.data.Media.episodes.toString()}\n- Average Score (out of 100): ${output.data.Media.averageScore.toString()}\n`,
						inline: false,
					}
				],
				image: {
					url: output.data.Media.coverImage.large,
				},
				// footer: {
				// 	text: `Episode ${output.data.Media.airingSchedule.nodes.episode.toString()} airs in ${output.data.Media.airingSchedule.nodes.timeUntilAiring.toString()}`
				// },
			};
			await interaction.reply({ embeds: [animeEmbed], ephemeral: ephemeral});
		}

		function handleError(error) {
			console.error(error);
		}
	},
};