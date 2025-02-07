const express = require("express");
const app = express();
const port = process.env.PORT || 3000;
const jwt = require("jsonwebtoken");
const extractJwt = require("passport-jwt").ExtractJwt;
const JwtStrategy = require("passport-jwt").Strategy;
const passport = require("passport");

app.use(express.json());

const MYSECRETJWTKEY = "secret";

const usersData = {
  users: [
    {
      userHandle: "John",
      password: "123",
    },
  ],
};

const scoresData = {
  levels: [],
};

const optionsForJwtValidationUser = {
  jwtFromRequest: extractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: MYSECRETJWTKEY,
};

passport.use(
  "jwt_str",
  new JwtStrategy(optionsForJwtValidationUser, function (payload, done) {
    done(null, true);
  })
);

app.post("/signup", (req, res) => {
  const { userHandle, password } = req.body;

  if (!userHandle || !password || userHandle.length < 6 || password.length < 6) {
    return res.status(400).json({ error: "Bad request" });
  }

  usersData.users.push({ userHandle, password });

  res.status(201).send("User registered successfully");
});

app.post("/login", (req, res) => {
  const { userHandle, password } = req.body;

  if (!userHandle || !password || typeof userHandle !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "Bad Request" });
  }

  const allowedFields = ["userHandle", "password"];
  const requestKeys = Object.keys(req.body);
  const invalidKeys = requestKeys.filter((key) => !allowedFields.includes(key));

  if (invalidKeys.length > 0) {
    return res.status(400).json({ error: "Bad Request" });
  }

  const user = usersData.users.find((u) => u.userHandle === userHandle);

  if (!user || user.password !== password) {
    return res.status(401).json({ error: "Unauthorized, incorrect username or password" });
  }

  const accessToken = jwt.sign({ userHandle: userHandle }, MYSECRETJWTKEY);
  return res.json({ jsonWebToken: accessToken });
});

app.post("/high-scores", passport.authenticate("jwt_str", { session: false }), (req, res) => {
  const { level, userHandle, score, timestamp } = req.body;

  if (!level || !userHandle || !score || !timestamp) {
    return res.status(400).json({ error: "Bad request" });
  }

  let levelData = scoresData.levels.find((l) => l.level === level);
  if (!levelData) {
    levelData = { level, highScores: [] };
    scoresData.levels.push(levelData);
  }

  levelData.highScores.push({ userHandle, score, timestamp });
  levelData.highScores.sort((a, b) => b.score - a.score);

  return res.status(201).json({ message: "High score posted successfully" });
});

app.get("/high-scores", (req, res) => {
  const levelName = req.query.level;
  const page = req.query.page ? parseInt(req.query.page, 10) : 1;

  if (!levelName || isNaN(page) || page < 1) {
    return res.status(400).json({ error: "Invalid level or page number" });
  }

  const levelData = scoresData.levels.find((level) => level.level === levelName);

  if (!levelData) {
    return res.status(200).json([]);
  }

  const startIndex = (page - 1) * 20;
  const endIndex = startIndex + 20;
  const paginatedScores = levelData.highScores.slice(startIndex, endIndex);

  const response = paginatedScores.map((score) => ({
    level: levelName,
    ...score,
  }));

  res.status(200).json(response);
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
