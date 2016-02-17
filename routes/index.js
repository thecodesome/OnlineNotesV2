var express = require('express');
var mysql = require('mysql');
var app = express();
var router = express.Router();
var obj = require('./obj');
var mailer = require("nodemailer");

var con = mysql.createConnection({
    host : 'localhost',
    user : 'root',
    password : 'gan',
    database : 'onlinenotesv2'
});
con.connect(function(err){
    if(err){console.log("Database Error");}
     else {console.log("Database Connected");}
});

function mail(to,subject,content){
        
    var smtpTransport = mailer.createTransport("SMTP",{
        service: "Gmail",
        auth: {
            user: "noreply.onotes@gmail.com",
            pass: "onlinenotesv2"
        }
    });

    var mail = {
        from: "ONotes <nororeply.onotes@gmail.com>",
        to: to,
        subject: subject,
        html: content
    }

    smtpTransport.sendMail(mail, function(error, response){
        if(error){
            console.log(error);
        }
        smtpTransport.close();
    });
}

router.get('/test',function(req,res){
    res.cookie('user' , "fooo",{signed:true});
    res.send('check');
});

router.get('/tested',function(req,res){
    console.log('mail viewed');
    res.send('done');
});

router.get('/', function(req, res, next) {
    if(!obj.siStatus(req,obj,obj.cookieKey)){
        res.render('index' , {superroremail:"",superrorusername:"",loginerror:"",signupmodal:"hide",loginmodal:"hide"});
    }
    else{
        res.redirect('/profile');
    }
});

router.post('/check/:x' , function(req,res,next){
    var x = req.params.x, s=req.body.s;
    console.log(s);
    if(x=="Email"){
        con.query(
            'select * from users where '+x+'=?',
            [s],
            function(err,rows){
                console.log(rows);
                if(rows.length){
                    res.send(x+" already exists");
                }
                else{
                    res.send(0);
                }
            }
        );
    }
});

router.post('/signup' , function(req,res,next){
    var username = req.body.username, email = req.body.email , password = obj.hash(req.body.password);

    con.query(
        "select * from users where email=?",
        [email],
        function(err,Row){
            if(Row.length){
                res.clearCookie('user');
                res.render('index',{superroremail: "This Email already exists" , loginerror:"",signupmodal:"show",loginmodal:"hide"})
            }
            else{
                                
                var date = new Date();
    
                var id ="u"+date.getFullYear().toString()+date.getMonth().toString()+date.getDate().toString()+date.getHours().toString()+date.getMinutes().toString()+date.getSeconds().toString();
                var key = id + '0^!in#N0TE$~~v2' + id + 398*Number(id.slice(1));
    
                con.query(
                    "insert into users set ?" , 
                    {id:id , username:username, email:email , password:password , userkey:key , verified:'no'} , 
                    function(err){
                        if(err) throw err;
                        var subject = "Verify your email id for ONotes";
                        var content = "<a href="+"'http://"+req.hostname+":3000/verify/"+obj.encrypt(id,obj.emailKey)+"/"+obj.encrypt(username,obj.emailKey)+"/"+obj.encrypt(email,obj.emailKey)+"/"+password+"' > verify </a>";
                        
                        mail(email,subject,content);
                        res.send('check mail');
                    }
                );
            }
        });
});


router.get('/verify/:id/:username/:email/:password' , function(req,res,next){
    
    var id = obj.decrypt(req.params.id,obj.emailKey);
    var username = obj.decrypt(req.params.username,obj.emailKey);
    var email = obj.decrypt(req.params.email,obj.emailKey); 
    var password = req.params.password;
    
    con.query(
        "select * from users where username=?",
        [username],
        function(err,userRow){
            if(!userRow.length){
                res.clearCookie('user');
                res.send("invalid link")
            }
            else if(userRow[0].verified == 'yes'){
                res.cookie('user' , obj.encrypt(id , obj.cookieKey));
                res.render('profile' , {rows: [] ,urows:[], greeting:obj.greeting(userRow[0].username)});
            }
            else{
                userRow[0].verified = 'yes';
                
                con.query('update users set verified="yes" where username=?',[username],function(err){if(err)throw err;});
                
                con.query(
                    "create table "+id+" ( id varchar(20) , name text , content text, updates int, primary key (id) )" ,
                    function(err){
                        if(err) throw err;
                    }
                );
                res.cookie('user' , obj.encrypt(id , obj.cookieKey),{signed:true});
                res.render('profile' , {rows: [],urows:[],greeting:obj.greeting(userRow[0].username)});
            }
        }
    );
    
    
});

router.post('/login' , function(req,res,next){
    var email = req.body.email , password = obj.hash(req.body.password);
    
    con.query('select * from users where email=?' , 
              [email] ,
              function(err,rows){
                if(rows.length && password==rows[0].password){
                    var c = obj.encrypt(rows[0].id , obj.cookieKey);
                    res.cookie('user' , c , {signed:true});
                    res.redirect('profile');
                }
                else{
                    res.render('index' , {superroremail:"",loginerror:"Invalid Credentials",signupmodal:"hide",loginmodal:"show"});;
                }
            });
});


router.get('/p/:str' , function(req,res,next){
    var str = req.params.str;
    
    con.query(
        'select * from public where str=?',
        [str],
        function(err,rows){
            if(!rows.length){
                res.send('Invalid Link');
            }
            else{
                con.query(
                    'select * from '+rows[0].userid+' where id=?',
                    [rows[0].noteid],
                    function(err,row){
                        con.query('select username from users where id=?',
                                  [rows[0].userid],
                                  function(err,R){
                            con.query(
                                'select userkey from users where id=?',
                                [rows[0].userid],
                                function(err,user){
                                    var key = user[0].userkey;
                                    var name = obj.decrypt(row[0].name,key);
                                    var content = obj.decrypt(row[0].content,key);
                                    res.render('public',{name:name ,    content:content , author:R[0].username});
                                });
                        });
                    }
                );
            }
        }
    );
});


module.exports = router;
