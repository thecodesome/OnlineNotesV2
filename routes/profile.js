var express = require('express');
var mysql = require('mysql');
var router = express.Router();
var obj = require('./obj');


var con = mysql.createConnection({
    host     : process.env.RDS_HOSTNAME || 'localhost',
  	user     : process.env.RDS_USERNAME || 'root',
  	password : process.env.RDS_PASSWORD || 'gan',
 	port     : process.env.RDS_PORT || '3306',
    database : 'ebdb'
});
con.connect(function(err){
    if(err){console.log("Database Error");}
     else {console.log("Database Connected");}
});

router.get('/', function(req, res, next) {
    
    if(!obj.siStatus(req,obj,obj.cookieKey)){
        res.redirect('/')
    }
    else{
        var userid = obj.siStatus(req,obj,obj.cookieKey); 
        
        con.query('select * from users where id=?' , [userid] ,function(err,row){
            var key = row[0].userkey;
            con.query(
                "select * from "+userid , 
                function(err,rows){
                    var i,j;
                    for(i=0;i<rows.length;i++){
                        rows[i].name = obj.decrypt(rows[i].name,key) 
                    }
                    
                    var xxrows = rows.slice(0,rows.length);
                    var xrows = [];
                    
                    for(i=0;i<xxrows.length;i++){
                        if(xxrows[i].updates){
                            xrows.push(xxrows[i]);
                        }
                    }
                    var temp;
                    for(i=0;i<xrows.length;i++){
                        for(j=i+1;j<xrows.length;j++){
                            if(xrows[j].updates<xrows[i].updates){
                                temp = xrows[j];
                                xrows[j] = xrows[i];
                                xrows[i] = temp;
                            }
                        }
                    }
                    
                    res.render('profile' , {rows:rows,urows:xrows,greeting:obj.greeting(row[0].username)});
                });
        });
        
    }
  
});

router.get('/createpage' , function(req,res,next){
    var userid = obj.siStatus(req,obj,obj.cookieKey);
    if(userid){
        con.query('select username from users where id=?' , [userid] ,function(err,rows){
            res.render('create',{greeting:obj.greeting(rows[0].username)});
        });
    }
    else{
        res.redirect('/');
    }
});

router.post('/createnote' , function(req,res,next){
    
    var userid = obj.siStatus(req,obj,obj.cookieKey);
    con.query('select userkey from users where id=?' , [userid] ,function(err,rows){
        var key = rows[0].userkey;
        
        var name = obj.encrypt(req.body.name,key);
        var content = obj.encrypt(req.body.content,key);
        
        var t = Date.now();
        console.log(t);
        
        var str = obj.randomString(6);
        con.query(
            "insert into "+userid+" set id=?,name=?,content=?,updates=0,public=0,str=?,align='left'" , 
            [t,name,content,str], 
            function(err){if(err) throw err;}
        );
                
        con.query(
            "create table n"+t.toString()+" ( id int(5) not null auto_increment, comment varchar(150) , primary key (id) )" ,
            function(err){
                if(err) throw err;
            }
        );
        
        con.query(
            "create table p"+str+" ( id int(5) not null auto_increment, username varchar(255) , comment text , primary key (id) )" ,
            function(err){
                if(err) throw err;
            }
        );
    
        res.redirect('/profile');
    });
});

router.get('/list', function(req, res, next) {
    
    if(!obj.siStatus(req,obj,obj.cookieKey)){
        res.redirect('/')
    }
    else{
        var userid = obj.siStatus(req,obj,obj.cookieKey); 
        
        con.query('select userkey from users where id=?' , [userid] ,function(err,row){
            var key = row[0].userkey;
            con.query(
                "select * from "+userid , 
                function(err,rows){
                    var i;
                    for(i=0;i<rows.length;i++){
                        rows[i].name = obj.decrypt(rows[i].name,key) 
                    }
                    con.query('select username from users where id=?' , [userid]    ,function(err,row){
                        res.render('list',{rows:rows,greeting:obj.greeting(row[0].username)});
                    });
                });
        });
        
    }
  
});




router.get('/readnote/:id' , function(req,res,next){
    if(!obj.siStatus(req,obj,obj.cookieKey)){
        res.redirect('/');
    }
    else{
        var userid = obj.siStatus(req,obj,obj.cookieKey);
        var noteid = req.params.id;
        con.query('select * from users where id=?' , [userid] ,function(err,row){
            var key = row[0].userkey;
            con.query(
                "select * from "+userid+" where id=?",
                [noteid],
                function(err,rows){
                        con.query(
                            "select * from n"+noteid,
                            function(err , cRow){
                                var i;
                                for(i=0;i<cRow.length;i++){
                                    cRow[i].comment = obj.decrypt(cRow[i].comment,key) 
                                }
                                
                                var publiclink , pv;
                                if(rows[0].public){
                                    pv = 1;
                                    publiclink =    "http://"+req.hostname+"/p/"+userid+"/"+rows[0].str;
                                }
                                else{
                                    pv = 0;
                                    publiclink = "";
                                }
                                        
                                res.render('read',{
                                    name : obj.decrypt(rows[0].name,key),
                                    content : obj.decrypt(rows[0].content,key),
                                    id : noteid,
                                    cRow : cRow,
                                    greeting: obj.greeting(row[0].username),
                                    pv:pv,
                                    publiclink:publiclink,
                                    str: rows[0].str,
                                    align: rows[0].align
                                });
                            });
                });
        });
    }
    
});

router.get('/deletenote/:id' , function(req,res,next){
    if(!obj.siStatus(req,obj,obj.cookieKey)){
        res.redirect('/');
    }
    else{
        var userid = obj.siStatus(req,obj,obj.cookieKey);
        
        con.query('select * from users where id=?',[userid],function(err,rows){
                var userid = obj.siStatus(req,obj,obj.cookieKey);
                var noteid = req.params.id;
        
                /*con.query(
                    'delete from public where userid=?', 
                    [userid] , 
                    function(err){
                        if(err) throw err;
                    });*/
            
                con.query('select str from '+userid+' where id=?', 
                    [noteid] ,  
                         function(err,strRow){
                    con.query(
                        'drop table p'+strRow[0].str ,
                        function(err){if(err)throw err;}
                    );
                });
            
                con.query(
                    'delete from '+userid+' where id=?', 
                    [noteid] , 
                    function(err){
                        if(err) throw err;
                        res.redirect('/profile/list');
                    });
        
                con.query(
                    'drop table n'+noteid ,
                    function(err){if(err)throw err;}
                    );
        });
    }
});


router.get('/logout' , function(req,res,next){
    res.clearCookie('user');
    res.redirect('/');
});

router.post('/edit/:id' , function(req,res,next){
    if(!obj.siStatus(req,obj,obj.cookieKey)){
        res.redirect('/');
    }
    else{
        var userid = obj.siStatus(req,obj,obj.cookieKey);
        var noteid = req.params.id;
        
        con.query('select userkey from users where id=?' , [userid] ,function(err,row){
            var key = row[0].userkey;
            var name = obj.encrypt(req.body.editedName,key);
            var content = obj.encrypt(req.body.editedContent,key);
            
            con.query(
                "select * from "+userid,
                function(err,rows){
                    var i,count=rows[0].updates;
                    for(i=1;i<rows.length;i++){
                        if(rows[i].updates>count){count=rows[i].updates;}
                    }
                    con.query("update "+userid+" set name=?,content=?,updates=? where id=?",
                              [name,content,count+1,noteid],
                              function(err){if(err) throw err;}
                             );
                });
            
            con.query(
                "select * from "+userid+" where id=?",
                [noteid],
                function(err,rows){
                        res.redirect('/profile/readnote/'+noteid);
                    });
        });
    }
    
});

router.post('/align/:noteid' , function(req,res,next){
    var noteid = req.params.noteid;
    var a = req.body.a;
    var userid = obj.siStatus(req,obj,obj.cookieKey);
    
    con.query("update "+userid+" set align=?  where id=?" , [a,noteid],function(err){});
});

router.post('/comment/:id' , function(req,res,next){
    var userid = obj.siStatus(req,obj,obj.cookieKey);
    con.query('select userkey from users where id=?' , 
              [userid] ,
              function(err,rows){
                    var key = rows[0].userkey;
                    var id = req.params.id;
                    var comment = obj.encrypt(req.body.comment,key);
                    con.query(
                        "insert into n"+id+" set ?" , 
                        {comment:comment} , 
                        function(err){
                            if(err) throw err;
                            res.send(obj.decrypt(comment,key));
                        }
                    );
            });
});

router.post('/comment/d/:noteid/:commid' , function(req,res,next){
    var noteid = req.params.noteid , commid = req.params.commid;
    
    con.query('delete from n'+noteid+' where id=?',
             [commid],
             function(err,rows){
        res.send("1");
    });
});

router.post('/p/:id/:str' , function(req,res,next){
    var noteid = req.params.id , str = req.params.str ;
    var userid = obj.siStatus(req,obj,obj.cookieKey);
    
    con.query('update '+userid+' set public=? where id=?',
                [1,noteid],
              function(err,row){
                    res.send("http://"+req.hostname+"/p/"+userid+"/"+str);
            });
    
    /*con.query(
        'select * from public where userid=? and noteid=?',
        [userid,noteid],
        function(err,rows){
            if(rows.length){
                console.log('one');
                res.send("http://"+req.hostname+"/p/"+rows[0].str);
            }
            else{*/
                /*var str = obj.randomString(7);
                con.query(
                    'insert into public set ?',
                    {str:str , userid:userid , noteid:noteid},
                    function(err,row){
                        console.log(str);
                        res.send("http://"+req.hostname+"/p/"+str);
                    }
                );*/
            /*}
        }
    );*/
});

router.post('/d/:id' , function(req,res,next){
    var noteid = req.params.id ;
    var userid = obj.siStatus(req,obj,obj.cookieKey);
    
    con.query(
        'update '+userid+' set public=0 where id=?',
                [noteid],
        function(err){
            if(err) throw err;
            res.send("");
        }
    );
});
 

module.exports = router;