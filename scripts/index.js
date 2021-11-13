//$("h1").append("<br/><button class='btn'>push me!</button>");





function postServer(){
	const Url = 'https://buddybot.ca';
	$.post(Url,'{data:"temp"}', function(result){
		
		var obj = JSON.parse(result);
		$('div.centrewrapper').empty();
		//level 1 - servername
		console.log(obj.isvalid);
		if(obj.isvalid){

			var songs = obj.songs;

			$.each(songs, function(index, song){		
					var title = song.title;
					var img   = song.thumbnail.url;
					var url   = song.url;

							
					//generate table
					$("<table>", {class:"songcontainer"})
					.append($('<tr>')
					.append($('<td>',{class:'center'}).html($('<div>',{class:'hamburger'}).html('<div/><div/><div/>')))
					.append($('<td>',{class:'thmbnail'}).html('<img loading=lazy src='+img+'/>'))
					.append($('<td>',{class:"songname"}).html(title)))
					.appendTo('div.centrewrapper');

						
			
				
				
			});	
		}
		else{
			$('div.centrewrapper').append('<div class=songcontainer>Empty Queue</div>');	
		}
			
});
}
postServer();


$(document).ready(function(){
	$('.button').click(function(){
		postServer();
	})
});


var intervalId = window.setInterval(function(){
  postServer();
}, 5000);
