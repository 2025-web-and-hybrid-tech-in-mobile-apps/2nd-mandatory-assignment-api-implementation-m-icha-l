const express = require("express");
const app = express();
const port = process.env.PORT || 3000;
const fs = require('fs');
const jwt = require('jsonwebtoken');
const extractJwt = require('passport-jwt').ExtractJwt;
const JwtStrategy = require('passport-jwt').Strategy;
const BasicStrategy = require('passport-http').BasicStrategy;
const passport = require('passport');

app.use(express.json()); 

const MYSECRETJWTKEY = "secret"

var optiosForJwtValidation_user = {
  jwtFromRequest: extractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: MYSECRETJWTKEY
};

passport.use('jwt_str', new JwtStrategy(optiosForJwtValidation_user, function (payload ,done) {
  done(null, true);
}));

app.post('/signup', (req, res) => {
  
  username = req.body.userHandle
  pass = req.body.password

  if (!username || !pass || username.length < 6 || pass.length < 6)
  {
    return res.status(400).json({ error: 'Bad request' });
  }
  
  data_to_file = {userHandle: username, password: pass ,}
  
  fs.readFile('users.json', 'utf8', (err, data) => 
  {
    if (err) 
    {
      return res.status(400).json({ error: 'Bad request' })
    }

    jsonData = JSON.parse(data);
    existing_user = jsonData.users.find(u => u.userHandle === username)
    
    jsonData.users.push(data_to_file);

    console.log(data_to_file);
    fs.writeFile('users.json', JSON.stringify(jsonData, null, 4), (err) => {
        if (err) {
            return res.status(403).json({ error: 'Bad Request' })
        }
        res.status(201).send("User registered successfully");
    });
  });
});

app.post('/login', (req, res) => {

  if (!req.body.userHandle || !req.body.password) 
  {
    return res.status(400).json({ error: "Bad Request" });
  }

  if (typeof req.body.userHandle !="string" || typeof req.body.password !="string") 
  {
    return res.status(400).json({ error: "Bad Request" });
  }

  allowedFields = ["userHandle", "password"];
  username = req.body.userHandle
  password = req.body.password

  const requestKeys = Object.keys(req.body);
  const invalidKeys = requestKeys.filter(key => !allowedFields.includes(key));
  
  if (invalidKeys.length > 0) {
    return res.status(400).json({ error: 'Bad Request' });
  }

  fs.readFile('users.json', 'utf8', (err, data) => 
  {
    if (err) 
    {
      return res.status(400).json({ error: "Bad Request" });
    }

    jsonData = JSON.parse(data);
    const user = jsonData.users.find(u => u.userHandle === username)

    if(!user)
    {
      return res.status(401).json({ error: "Unauthorized, incorrect username or password" });
    }

    if(username === user.userHandle && password === user.password)
    {
      const accessToken = jwt.sign({ userHandle: username }, MYSECRETJWTKEY);
      return res.json({ jsonWebToken: accessToken });
    } 
    else
    {
      return res.status(401).json({ error: "Unauthorized, incorrect username or password" });
    }
  })
});


app.post('/high-scores', passport.authenticate('jwt_str', { session: false }), async (req, res) => {
  const { level, userHandle, score, timestamp } = req.body;
  if (!level || !userHandle || !score || !timestamp) {
    return res.status(400).json({ error: 'Bad request' });
  }

  try {
    const data = await fs.promises.readFile('scoreboard.json', 'utf8');
    const jsonData = JSON.parse(data);

    let levelData = jsonData.levels.find(l => l.level === level);
    if (!levelData) {
      jsonData.levels.push({
        level: level,
        highScores: [{ userHandle, score, timestamp }]
      });
    } else {
      levelData.highScores.push({ userHandle, score, timestamp });
      levelData.highScores.sort((a, b) => b.score - a.score);
    }

    await fs.promises.writeFile('scoreboard.json', JSON.stringify(jsonData, null, 4));
    return res.status(201).json({ message: 'High score posted successfully' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/high-scores', (req, res) => {
  const level_name = req.query.level;
  const page = req.query.page ? parseInt(req.query.page, 10) : 1; 

  if (!level_name || isNaN(page) || page < 1) {
    return res.status(400).json({ error: 'Invalid level or page number' });
  }

  fs.readFile('scoreboard.json', 'utf8', (err, data) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to read scoreboard file' });
    }

    const jsonData = JSON.parse(data);
    const lvl = jsonData.levels.find(level => level.level === level_name); 

    if (!lvl) {
      return res.status(200).json([]); 
    }

    const startIndex = (page - 1) * 20;
    const endIndex = startIndex + 20;
    const paginatedScores = lvl.highScores.slice(startIndex, endIndex);

    const response = paginatedScores.map(score => ({
      level: level_name,
      ...score
    }));

    res.status(200).json(response);
  });
});

let serverInstance = null;
module.exports = {
  start: function () {
    serverInstance = app.listen(port, () => {
      console.log(`Example app listening at http://localhost:${port}`);
    });
  },
  close: function () {
    serverInstance.close();
  },
};
