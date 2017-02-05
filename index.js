var Twitter = require('twitter');
var yargs   = require('yargs');
var fs      = require('fs');
var request = require('request');
var Promise = require('bluebird');
var mkdirp  = require('mkdirp');
var colors  = require('colors/safe');

// Create program
var program = yargs
                .usage('Usage: $0 [options]')
                .alias('n', 'name')
                .describe('n', 'Set screen_name')
                .demandOption(['n'])
                .alias('o', 'output')
                .describe('o', 'Set path output folder')
                .alias('m', 'max_id')
                .describe('m', 'Set max_id')
                .help('h')
                .alias('h', 'help')
                .epilog('Crawl Twitter by fouqui_c #2017')
                .argv;

// Get config json
var configPath = __dirname + "/config.json";
if (!fs.existsSync(configPath)) {
    console.log(colors.red('Missing config file.'));
    process.exit(1);
}

var config = JSON.parse(fs.readFileSync(configPath, "utf-8"));

// Init Client Twitter
var client = new Twitter({
    consumer_key: config.consumer_key,
    consumer_secret: config.consumer_secret,
    access_token_key: config.access_token_key,
    access_token_secret: config.access_token_secret
});

var twitterSearchAsync = function(options) {
    return new Promise(function(resolve, reject) {
        client.get('statuses/user_timeline', options, function(error, request, response) {
            if (error) {
                console.log(colors.red(error));

                if (options.max_id) {
                    console.log(colors.cyan('--> Info:'));
                    console.log(colors.cyan('    ├──── Request: statuses/user_timeline'));
                    console.log(colors.cyan('    └──── Options: %s'), JSON.stringify(options));
                }

                process.exit(1);
            }

            var tweets = JSON.parse(response.body);
            var data = { 'options': options, 'tweets': tweets };

            resolve(data);
        });
    });
}

var getMaxHistory = function(data) {
    var max_id, oldest, newest, options, tweets, nbTweets;

    options = data.options;
    tweets = data.tweets;
    nbTweets = tweets.length;

    if (nbTweets > 0) {
        options.max_id = tweets[nbTweets - 1].id - 1;
    }

    stuff(tweets);

    if (nbTweets < 2) {
        console.log('--> Total tweets with images (%s)', nbTotalsTweetsWithImages);
    }
    else {
        twitterSearchAsync(options).then(getMaxHistory);
    }
}

// Loop tweets for save images
var stuff = function(tweets) {
    if (tweets.length > 0) {
        tweets.forEach(function(tweet, index, array) {
            if (tweet.entities && tweet.entities.media) {
                var medias = tweet.entities.media;
                medias.forEach(function(media, index, array) {
                    if (media.type == 'photo') {
                        nbTotalsTweetsWithImages++;
                        var url = media.media_url_https;
                        var splitUrl = url.split('/');
                        var filename = splitUrl[splitUrl.length - 1];
                        var path = '';

                        if (program.output) {
                            path = program.output + '/';
                        }

                        if (!fs.existsSync(path)) {
                            mkdirp(path);
                        }

                        var pathname = path + filename;
                        download(url, pathname, function() {
                            console.log('Download', url, '-', colors.green('OK'), '(' + indexDownload + ')');
                            indexDownload++;
                        });
                    }
                });
            }
            indexTweet++;
        });
    }
}

// Download images
var download = function(uri, filename, callback) {
    request.head(uri, function(err, res, body) {
        request(uri)
            .pipe(fs.createWriteStream(filename))
            .on('close', callback);
    });
};

// Init crawl
var options = {
    screen_name: program.name,
    count: 200,
    include_rts: false,
    exclude_replies: true
};
var nbTotalsTweetsWithImages = 0;
var indexDownload = 1;
var indexTweet = 1;

// If option -m set option max_id
if (program.max_id) {
    options.max_id = program.max_id;
}

// If option -c get account
if (program.name) {
    console.log(colors.cyan('--> Retrieves images of ' + colors.bold('@' + program.name)));
    twitterSearchAsync(options).then(getMaxHistory);
}
