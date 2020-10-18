const Client = require('instagram-private-api').V1;
const delay = require('delay');
const chalk = require('chalk');
const _ = require('lodash');
const rp = require('request-promise');
const S = require('string');
const inquirer = require('inquirer');
var fs = require('fs'),
    request = require('request');
	
const User = [
{
  type:'input',
  name:'username',
  message:'[>] Masukan Username:',
  validate: function(value){
    if(!value) return 'Tidak\'Bisa Kosong';
    return true;
  }
},
{
  type:'password',
  name:'password',
  message:'[>] Masukan Password:',
  mask:'*',
  validate: function(value){
    if(!value) return 'Tidak\'Bisa Kosong';
    return true;
  }
},
{
  type:'input',
  name:'target',
  message:'[>] Masukan Username Target (Tanpa @ Contoh => jokowi tanpa @):',
  validate: function(value){
    if(!value) return 'Tidak\'Bisa Kosong';
    return true;
  }
},
{
  type:'input',
  name:'mysyntx',
  message:'[>] Masukan Total Yang Ingin Di Follow (Contoh => 2000):',
  validate: function(value){
    value = value.match(/[0-9]/);
    if (value) return true;
    return 'Masukan Hanya Nomor!';
  }
},
{
  type:'input',
  name:'sleep',
  message:'[>]Masukan number (660000) Untuk Jeda:',
  validate: function(value){
    value = value.match(/[0-9]/);
    if (value) return true;
    return 'Delay is number';
  }
}
]

const Login = async function(User){

  const Device = new Client.Device(User.username);
  const Storage = new Client.CookieMemoryStorage();
  const session = new Client.Session(Device, Storage);

  try {
    await Client.Session.create(Device, Storage, User.username, User.password)
    const account = await session.getAccount();
    return Promise.resolve({session,account});
  } catch (err) {
    return Promise.reject(err);
  }

}

const Target = async function(username){
  const url = 'https://www.instagram.com/'+username+'/'
  const option = {
    url: url,
    method: 'GET'
  }
  try{
    const account = await rp(option);
    const data = S(account).between('<script type="text/javascript">window._sharedData = ', ';</script>').s
    const json = JSON.parse(data);
    if (json.entry_data.ProfilePage[0].graphql.user.is_private) {
      return Promise.reject('Target private Account');
    } else {
      const id = json.entry_data.ProfilePage[0].graphql.user.id;
      const followers = json.entry_data.ProfilePage[0].graphql.user.edge_followed_by.count;
      return Promise.resolve({id,followers});
    }
  } catch (err){
    return Promise.reject(err);
  }

}

async function ngefollow(session,accountId){
  try {
    await Client.Relationship.create(session, accountId);
    return true
  } catch (e) {
    return false
  }
}

async function ngeComment(session, id, text){

}

async function ngeLike(session, id){
}

const CommentAndLike = async function(session, accountId, text){
  var result;

  const feed = new Client.Feed.UserMedia(session, accountId);

  try {
    result = await feed.get();
  } catch (err) {
    return chalk`{bold.red ${err}}`;
  }

  if (result.length > 0) {
    const task = [
    ngefollow(session, accountId),
    ]
    const [Terfollow] = await Promise.all(task);
    const printFollow = Terfollow ? chalk`{cyan Terfollow}` : chalk`{cyan Terfollow}`;
    return chalk`{bold.blue ${printFollow} [${text}]}`;
  }
  return chalk`{bold.white Timeline Kosong (SKIPPED)}`
};

const Followers = async function(session, id){
  const feed = new Client.Feed.AccountFollowers(session, id);
  try{
    const Pollowers = [];
    var cursor;
    do {
      if (cursor) feed.setCursor(cursor);
      const getPollowers = await feed.get();
      await Promise.all(getPollowers.map(async(akun) => {
        Pollowers.push(akun.id);
      }))
      cursor = await feed.getCursor();
    } while(feed.isMoreAvailable());
    return Promise.resolve(Pollowers);
  } catch(err){
    return Promise.reject(err);
  }
}

const Excute = async function(User, TargetUsername, Sleep, mysyntx){
  try {
    console.log(chalk`{yellow \n [?] Mencoba Login Silahkan Tunggu sebentar . . .}`)
    const doLogin = await Login(User);
    console.log(chalk`{green  [!] Login Berhasil, }{yellow [?] Mencoba Mendapatkan ID & Followers Target . . .}`)
    const getTarget = await Target(TargetUsername);
    console.log(chalk`{green  [!] ${TargetUsername}: [${getTarget.id}] | Followers: [${getTarget.followers}]}`)
    const getFollowers = await Followers(doLogin.session, doLogin.account.id)
    console.log(chalk`{cyan  [?] Mencoba Follow Dari Followers Target . . . \n}`)
    const Targetfeed = new Client.Feed.AccountFollowers(doLogin.session, getTarget.id);
    var TargetCursor;
    do {
      if (TargetCursor) Targetfeed.setCursor(TargetCursor);
      var TargetResult = await Targetfeed.get();
      TargetResult = _.chunk(TargetResult, mysyntx);
      for (let i = 0; i < TargetResult.length; i++) {
        var timeNow = new Date();
        timeNow = `Jam ${timeNow.getHours()}:${timeNow.getMinutes()}:${timeNow.getSeconds()}`
        await Promise.all(TargetResult[i].map(async(akun) => {
          if (!getFollowers.includes(akun.id) && akun.params.isPrivate === false) {
	    var Text = fs.readFileSync('cookies.txt', 'utf8').split('|');
            var ranText = Text[Math.floor(Math.random() * Text.length)];
	    var iki = ''+akun.params.username+' '+ranText;
            const ngeDo = await CommentAndLike(doLogin.session, akun.id, iki)
            console.log(chalk`[{cyan ${timeNow}}] {bold.blue [>]}${akun.params.username} => ${ngeDo}`)
          } else {
            console.log(chalk`[{cyan ${timeNow}}] {bold.blue [SKIP]}${akun.params.username} => PRIVATE ATAU SUDAH TERFOLLOW`)
          }
        }));
        console.log(chalk`{cyan \n [#][>] Delay For ${Sleep} /20 Menit [<][#] \n}`);
        await delay(Sleep);
      }
      TargetCursor = await Targetfeed.getCursor();
      console.log(chalk`{cyan \n [#][>] Delay For ${Sleep} /20 Menit [<][#] \n}`);
      await delay(Sleep);
    } while(Targetfeed.isMoreAvailable());
  } catch (err) {
    console.log(err);
  }
}

console.log(chalk`
  {bold.cyan
  —————————————————— [INFORMATION] ————————————————————

  [?] {bold.green Github.com/farrriq}
  [?] {bold.green Error Kasih Tau Saya}

  —————————————————————————————————————————————————————
  V 0.2
  1. Follow Dari Followers Orang
  —————————————————————————————————————————————————————}
      `);
//ikiganteng
inquirer.prompt(User)
.then(answers => {
  Excute({
    username:answers.username,
    password:answers.password
  },answers.target,answers.sleep,answers.mysyntx);
})
