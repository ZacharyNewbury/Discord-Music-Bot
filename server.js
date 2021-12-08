//---setup variables---
const { Client, Collection, Intents, MessageEmbed} = require('discord.js');
const Discord = require('discord.js');
const { prefix, clientId, token } = require("./config.json");
const ytdl = require("ytdl-core");
const ytpl = require("ytpl")
const fs = require('fs');
const express = require('express');
const app = express();
const queue = new Map();
const http = require('http');
const https = require('https');
const mariadb = require('mariadb');
var attempts = 0;
const slashRenew = false; //used if slash commands need to be updated
const deployCommands = require('./deploy-commands.js')



//--setup commands from modules--
const client = new Client({
  intents: [Intents.FLAGS.GUILDS]
});


client.once("ready", () => {
	console.log("Ready!");
	//register slash commands for each server
	if(slashRenew){
		var iterator = client.guilds.cache.keys();
		for(const guildId of iterator){
			deployCommands(token, clientId, guildId);
		}
	}
});



client.once("reconnecting", () => {
	console.log("Reconnecting!");
});

client.once("disconnect", () => {
	console.log("Disconnect!");
});



//---command section---


client.on('message', async message => {


	if (message.author.bot) return;
	if (!message.content.startsWith(prefix)) return;
	
	const serverQueue = queue.get(message.guild.id);

	if (message.content.startsWith(`${prefix}play`)) {
		execute(message, serverQueue);
		return;
	} else if (message.content.startsWith(`${prefix}skip`)) {
		skip(message, serverQueue);
		return;
	} else if (message.content.startsWith(`${prefix}test`)) {
		var temp = message.content.split(" ");
		message.content = temp[0] + " https://www.youtube.com/watch?v=rxTY9sgvUwA&list=PL2XjmdkuVL-03sRUqbEFAgiHg08isEC-l"
		execute(message, serverQueue);
		return;
	}else if (message.content.startsWith(`${prefix}clear`)) {
		clear(message, serverQueue);
		return;
	}else if (message.content.startsWith(`${prefix}stop`)) {
		stop(message, serverQueue);
		return;
	} else if (message.content.startsWith(`${prefix}help`)) {
		help(message);
		return;
	} else if (message.content.startsWith(`${prefix}shuffle`)) {
		shuffle(message, serverQueue);
		return;
	} else {
		message.channel.send("You need to enter a valid command!");
	}
	
});

async function help(message){
	message.channel.send(`List of Commands:\n`
		+`\`play\`\t- add a song or playlist to the song queue, also starts playing songs.\n`
		+`\`skip\`\t- skip to next song in queue\n`
		+`\`clear\`\t- clears song queue.\n`
		+`\`stop\`\t- stops playing and clears the song queue\n`
		+`\`shuffle\`\t- shuffles the song queue randomly\n`
		);
}


async function shuffle(message, serverQueue){
	//songs is an array
	var playing = serverQueue.songs.shift();					//playing
	serverQueue.songs.sort(() => Math.random() - 0.5);//shuffle
	serverQueue.songs.unshift(playing);								//add back to queue
	message.channel.send(`queue has been shuffled`);
}

async function execute(message, serverQueue) {
	const args = message.content.split(" ");
	

	//error catching
	if(args.length > 2){
		return message.channel.send("To many arguments, can only accept a playlist url or video url.");
	}
	if(args.length == 1){
		return message.channel.send("no argument, please provide a link to a video or playlist.");
	}
	const url = args[1];

	

	const voiceChannel = message.member.voice.channel;
	if (!voiceChannel)
		return message.channel.send("You need to be in a voice channel to play music!");
	const permissions = voiceChannel.permissionsFor(message.client.user);
	if (!permissions.has("CONNECT") || !permissions.has("SPEAK")) {
		return message.channel.send("I need the permissions to join and speak in your voice channel!");
	}



	//check if playlist
	const isPlaylist = url.includes('list');
	const songs = [];
	var playlistTitle = '';
	var playlistLength = 0;

	if(isPlaylist){
		try{
			console.log('playlist found');
			const id = await ytpl.getPlaylistID(url);
			const playlist = await ytpl(id);
			playlistTitle = playlist.title;
			playlistLength = playlist.items.length;
			
			
			console.log(`title: ${playlistTitle},\nSongs:${playlistLength}`)
			for(var item=0; item<playlist.items.length; item++){
				

				var song = {
					title: playlist.items[item].title,
					url: playlist.items[item].shortUrl,
					thumbnail: playlist.items[item].bestThumbnail.url,
					videolength: playlist.items[item].durationSec,
					author: playlist.items[item].author
				};
				

				
				songs.push(song);
			}
			
		}
		catch(err){
			console.log(err);
			return message.channel.send("unknown playlist: check that url is correct.");
			
		}
	}
	else{
		const songInfo = await ytdl.getInfo(url);
		//look for this and remove the rest including this
		
		const thumburl = songInfo.videoDetails.thumbnails[0].url.split('/');
		
		const song = {
			title: songInfo.videoDetails.title,
			url: songInfo.videoDetails.video_url,
			thumbnail:'https://i.ytimg.com/vi/'+thumburl[4]+'/maxresdefault.jpg',
			videolength:songInfo.videoDetails.lengthSeconds,
			author: songInfo.videoDetails.author
		};	



		songs.push(song);
	}

	

	if (!serverQueue || serverQueue.songs.length === 0) {
		const queueContruct = {
			serverName: message.guild.name,
			serverPicture: message.guild.iconURL(),
			textChannel: message.channel,
			voiceChannel: voiceChannel,
			connection: null,
			songs: [],
			volume: 5,
			playing: true
		};

		queue.set(message.guild.id, queueContruct);

		for(var i=0; i<songs.length;i++){
			queueContruct.songs.push(songs[i]);	
		}
		
		if(isPlaylist)
			message.channel.send(`Playlist Added to the Queue!\nPlaylist:**${playlistTitle}**\nSongs:**${playlistLength}**`);

		try {
			var connection = await voiceChannel.join();
			queueContruct.connection = connection;
			play(message.guild, queueContruct.songs[0]);
		} catch (err) {
			console.log(err);
			queue.delete(message.guild.id);
			return message.channel.send(err);
		}
	} else {

		for(var i=0; i<songs.length;i++){
			serverQueue.songs.push(songs[i]);	
		}
		if(isPlaylist){

			return message.channel.send(`Playlist Added to the Queue!\nPlaylist:**${playlistTitle}**\nSongs:**${playlistLength}**`);
		}
		else
			return message.channel.send(`${songs[0].title} has been added to the queue!`);
	}
}

function skip(message, serverQueue) {
	

	if (!message.member.voice.channel)
		return message.channel.send(
			"You have to be in a voice channel to stop the music!"
			);
	//if (serverQueue.songs.length === 0)
	//	return message.channel.send("There is no song that I could skip!");
	try{
	serverQueue.connection.dispatcher.end();
	}catch(err){console.log(err);}
}


function clear(message, serverQueue){
	if (!message.member.voice.channel)
		return message.channel.send(
			"You have to be in a voice channel to stop the music!"
			);

	if (!serverQueue)
		return message.channel.send("No songs added yet to clear!");
	serverQueue.songs = [serverQueue.songs[0]];
	if(!message.pogger){
		return message.channel.send("Songs Queue Emptied.");	
	}
	
}

function stop(message, serverQueue) {
	message.pogger = true;
	clear(message, serverQueue);
	skip(message, serverQueue);
	serverQueue.voiceChannel.leave();
}

function play(guild, song) {
	const serverQueue = queue.get(guild.id);
	if (!song) {
		//serverQueue.voiceChannel.leave();
		//queue.delete(guild.id);
		return;
	}

	const dispatcher = serverQueue.connection
	.play(ytdl(song.url, {filter: 'audioonly'}, {quality: 'highestaudio', highWaterMark: 1 << 25}))
	.on("finish", () => {
		attempts = 0;
		serverQueue.songs.shift();
		play(guild, serverQueue.songs[0]);
	})
	.on("error", error => {
		attempts++;
		console.error("playback error :: "+error.message);
		if(!error.message.includes("aborted")){
			if(attempts < 3){
				console.error("trying to download again.");
				play(guild, serverQueue.songs[0]);
			}
			else{
				console.error("to many attempts, moving to next song");
				attempts = 0;
				serverQueue.songs.shift();
				play(guild, serverQueue.songs[0]);
				return serverQueue.textchannel.send("\`couldnt play song, skiped to next song\`");
			}
		}
		else{
			serverQueue.songs.shift();
		}
		
	});
	dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
	
	var time  = new Date(song.videolength * 1000).toISOString().substr(11, 8);

	//discord embed message
	var embed = new MessageEmbed()
  .setColor(0x3498DB)
  .setAuthor(song.author.name, "")
  .setTitle(song.title)
  .setURL(song.url)
  .setThumbnail(song.thumbnail)
  .addField("Duration", time);

  serverQueue.textChannel.send({ embed: embed });
	
}

client.login(token);



// Certificate
const privateKey = fs.readFileSync('/etc/letsencrypt/live/buddybot.ca/privkey.pem', 'utf8');
const certificate = fs.readFileSync('/etc/letsencrypt/live/buddybot.ca/cert.pem', 'utf8');
const ca = fs.readFileSync('/etc/letsencrypt/live/buddybot.ca/chain.pem', 'utf8');
const options ={key:privateKey,cert:certificate};

app.use(express.static("/home/zack/discord-musicbot", { dotfiles: 'allow' }));

const httpServer = http.createServer(app);
const httpsServer = https.createServer(options, app);

httpServer.listen(80, () => {
	console.log(`express running → PORT ${httpServer.address().port}`);
});

httpsServer.listen(443, () => {
	console.log(`express running → PORT ${httpsServer.address().port}`);
});


app.set('view engine', 'pug');


// Parse URL-encoded bodies (as sent by HTML forms)
app.use(express.urlencoded());
// Parse JSON bodies (as sent by API clients)
app.use(express.json());



// Access the parse results as request.body
app.post('/', function(request, response){
    var pairs = {};

    queue.forEach((serverQueue, guild)=>{
    	
    	if(serverQueue){
    		var songs  = serverQueue.songs;
    		pairs["songs"] = songs;
    		pairs["serverPicture"] = serverQueue.serverPicture;
    		pairs["isvalid"]=true;
    	}
    	else{
    		pairs["isvalid"]=false;
    	}
    });

    if(Object.keys(pairs).length===0){
    	pairs["isvalid"]=false;
    }
    var x = JSON.stringify(pairs);
    response.end(x);
});

app.get('/', (req, res) => {
  res.render('index.pug', {
  	title: 'BuddyBot'
  });
});