const express=require("express")

const bcrypt = require('bcrypt');

const jwt=require("jsonwebtoken")

const path=require("path")
const app=express()

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const databasePath = path.join(__dirname, "userinfo.db");

app.use(express.json()) //It is a built-in middleware function it recognizes the incoming request object as a JSON object, parses it, and then calls handler in every API call

console.log('Current directory:', __dirname);

let database;

const Server = async () => {
    try {
      database = await open({
        filename: databasePath,
        driver: sqlite3.Database,
      });
      app.listen(3000, () => {
        console.log("Started at 3000port");
      });
    } catch (e) {
      console.log(`DB Error: ${e.message}`);
      process.exit(1);
    }
  };
  
  Server();

//register api call using bycrpt create encrypt password with  hash method

  app.post("/register/", async (request, response) => {
    const {email,username, password, role} = request.body;
    const Password = await bcrypt.hash(request.body.password, 10);
    const Query = `SELECT * FROM user WHERE username = '${username}'`;
    const dbUser = await database.get(Query);
    if (dbUser === undefined) {
      const insertQuery = `
        INSERT INTO 
          user (email,username,password, role) 
        VALUES 
          (
            '${email}', 
            '${username}',
            '${Password}', 
            '${role}'
          )`;
      const dbResponse = await database.run(insertQuery);
      const newUserId = dbResponse.lastID;
      response.send(`Created new user with ${newUserId}`);
    } else {
      response.status = 400;
      response.send("User already exists");
    }
  });

// login api call using bycrpt compare method

  app.post("/login", async (request, response) => {
    const { username, password } = request.body;
    const Query = `SELECT * FROM user WHERE username = '${username}'`;
    const dbUser = await database.get(Query);
    if (dbUser === undefined) {
      response.status(400);
      response.send("Invalid User");
    } else {
      const Password = await bcrypt.compare(password, dbUser.password); //comparing passwords
      if (Password === true) {
        const payload = {
            username: username,
            role : dbUser.role
          };
          const jwtToken = jwt.sign(payload, "skygoaltech"); // arguments as payload and secret key
          response.send({ jwtToken });
      } else {
        response.status(400);
        response.send("Invalid Password");
      }
    }
  });

  //middleware function

  const verfingToken = (request, response, next) => {
    let jwtToken;
    const authHeader = request.headers["authorization"];
    if (authHeader !== undefined) {
      jwtToken = authHeader.split(" ")[1];
    }
    if (jwtToken === undefined) {
      response.status(401);
      response.send("Invalid JWT Token");
    } else {
      jwt.verify(jwtToken, "skygoaltech", (error, payload)=> {
              if (error) {
                  response.status(401);
                  response.send("Invalid JWT Token");
              } else {
                  request.username = payload.username;
                  request.role = payload.role;
                  next();
              }
          });
    }
  };

  const isAdmin = (req, res, next) => {
    if (req.role !== "admin") {
      return res.status(403).json({ error: "Admin role required" });
    }
    next();
  };

  //isAdminorManager middleware
  const isAdminOrManager = (req, res, next) => {
    if (req.role !== 'admin' && req.role !== 'manager') {
      return res.status(403).json({ error: 'Admin or manager role required' });
    }
    next();
  };

  app.post("/api/products", verfingToken, isAdmin, async (req, res) => {
    const { title, description, inventory_count } = req.body;
    console.log(title)
    try {
      const insertQuery = `
        INSERT INTO products 
        (title, description, inventory_count)
        VALUES 
        ('${title}', '${description}','${inventory_count}')`;
      const result = await database.run(insertQuery);
      const newProductId = result.lastID;
      res.status(201).json({ message: "Product created successfully", productId: newProductId });
    } catch (error) {
      console.error("Error creating product:", error.message);
      res.status(500).json({ error: "Internal server error" });
    }
  })

  // Product Read (Admin or Manager)
app.get("/api/products", verfingToken, isAdminOrManager, async (req, res) => {
  const selectQuery = `SELECT * FROM products`;
  try {
    const products = await database.all(selectQuery);
    res.json(products);
  } catch (error) {
    console.error("Error fetching products:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Product Update (Admin or Manager)
app.put("/api/products/:id", verfingToken, isAdminOrManager, async (req, res) => {
  const { title, description, inventory_count } = req.body;
  const { id } = req.params;
  const updateQuery = `
    UPDATE products
    SET title = '${title}', description = '${description}', inventory_count = '${inventory_count}'
    WHERE id = '${id}'
  `;
  try {
    const result = await database.run(updateQuery);
    if (result.changes === 0) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json({ message: "Product updated successfully" });
  } catch (error) {
    console.error("Error updating product:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Product Delete (Admin Only)
app.delete("/api/products/:id", verfingToken, isAdmin, async (req, res) => {
  const { id } = req.params;
  const deleteQuery = `DELETE FROM products WHERE id = '${id}'`;
  try {
    const result = await database.run(deleteQuery);
    if (result.changes === 0) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error("Error deleting product:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});