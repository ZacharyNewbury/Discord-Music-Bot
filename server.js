//---setup variables---
const { Client, Collection, Intents } = require('discord.js');
const { prefix, clientId, token } = require("./config.json");
const ytdl = require("ytdl-core");
const ytpl = require("ytpl")
const fs = require('fs');
const express = require('express');
const app = express();
const queue = new Map();
const http = require('http');
const https = require('https');
var attempts = 0;
const deployCommands = require('./deploy-commands.js')



//--setup commands from modules--
const client = new Client({
  intents: [Intents.FLAGS.GUILDS]
});


client.once("ready", () => {
	console.log("Ready!");
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
	serverQueue.songs.sort(() => Math.random() - 0.5);
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
					thumbnail: playlist.items[item].bestThumbnail
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
		const song = {
			title: songInfo.videoDetails.title,
			url: songInfo.videoDetails.video_url,
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
			console.log(serverQueue.songs.length);
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
	serverQueue.songs = [];
	if(!message.pogger){
		return message.channel.send("Songs Queue Emptied.");	
	}
	
}

function stop(message, serverQueue) {
	message.pogger = true;
	clear(message, serverQueue);
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
	.play(ytdl(song.url, {filter: 'audioonly'}, {quality: 'lowestaudio'}))
	.on("finish", () => {
		attempts = 0;
		serverQueue.songs.shift();
		play(guild, serverQueue.songs[0]);
	})
	.on("error", error => {
		attempts++;
		console.error("video downlaod error:\n"+error);
		if(attempts < 3){
			console.error("trying to download again.");
			play(guild, serverQueue.songs[0]);
		}
		else{
			console.error("to many attempts, moving to next song");
			attempts = 0;
			serverQueue.songs.shift();
			play(guild, serverQueue.songs[0]);
			return message.channel.send("\`couldnt play song, skiped to next song\`");
		}
	});
	dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
	serverQueue.textChannel.send(`Now Playing: **${song.title}**`);
}

client.login(token);


//--web interface section--


// Certificate for https server
const privateKey = fs.readFileSync('/absolute/to/your/privateKey', 'utf8');
const certificate = fs.readFileSync('/absolute/to/your/cert', 'utf8');
const ca = fs.readFileSync('/absolute/to/your/centralauthority', 'utf8');
const options ={key:privateKey,cert:certificate};


app.use(express.static("/absolute/to/your/serverlocation", { dotfiles: 'allow' }));

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