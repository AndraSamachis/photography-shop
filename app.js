
const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const bodyParser = require('body-parser')

const session = require('express-session');
const cookieParser=require('cookie-parser');
const sqlite3 = require('sqlite3').verbose();
const app = express();
app.use(cookieParser());
const port = 6789;
const fs = require('fs');
app.use(
  session({
    secret: 'your-secret-key',
    resave: true,
    saveUninitialized: true
  })
);
// directorul 'views' va conține fișierele .ejs (html + js executat la server)
app.set('view engine', 'ejs');
// suport pentru layout-uri - implicit fișierul care reprezintă template-ul site-ului este views/layout.ejs
app.use(expressLayouts);
// directorul 'public' va conține toate resursele accesibile direct de către client (e.g., fișiere css, javascript, imagini)
app.use(express.static('public'))
// corpul mesajului poate fi interpretat ca json; datele de la formular se găsesc în format json în req.body
app.use(bodyParser.json());
// utilizarea unui algoritm de deep parsing care suportă obiecte în obiecte
app.use(bodyParser.urlencoded({ extended: true }));
const ipAccessCount = {};
// Definiți un obiect pentru a urmări IP-urile blocate și timpul la care vor fi deblocate
const blockedIPs = {};

// Middleware pentru blocarea accesului IP-ului
const blockIPMiddleware = (req, res, next) => {
  const clientIP = req.ip; // Obțineți adresa IP a clientului

    // Dacă IP-ul clientului este blocat
    const currentTime = Date.now();
    if (ipAccessCount[clientIP] >= 4 && currentTime < blockedIPs[clientIP]) {
      // IP-ul este încă blocat, întoarceți o eroare
      console.log(`IP-ul ${clientIP} este blocat`);
      return res.status(403).send('Accesul interzis');
    } else {
     
      // ridicam blocarea IP-ului
      delete blockedIPs[clientIP];
      console.log(`IP-ul ${clientIP} a fost deblocat`);
    }
  

  next();
};

app.use(blockIPMiddleware);
app.get('/', (req, res) => res.redirect('/index'));
// la accesarea din browser adresei http://localhost:6789/chestionar se va apela funcția
//specificată
app.get('/chestionar', (req, res) => {
   fs.readFile('intrebari.json', 'utf8', (err, data) => {
      if (err) {
        console.error(err);
        res.status(500).send('Eroare la citirea fișierului intrebari.json');
        return;
      }
  
      const intrebari = JSON.parse(data);
      res.render('chestionar', { intrebari });
   });
 // în fișierul views/chestionar.ejs este accesibilă variabila 'intrebari' care conține vectorul de întrebări
 //res.render('chestionar', {intrebari});
});
app.post('/rezultat-chestionar', (req, res) => {
   fs.readFile('intrebari.json', 'utf8', (err, data) => {
     if (err) {
       console.error(err);
       res.status(500).send('Eroare la citirea fișierului intrebari.json');
       return;
     }
 
     const intrebari = JSON.parse(data);
     res.render('rezultat-chestionar', { intrebari, req });
   });
 });
//**************COOKIE VS SESIUNI */
app.get('/index', (req, res) => {
  const numeUtilizator = req.session.numeUtilizator || ''; 
  const nume = req.session.nume || ''; //HERE MODIFY
  const prenume = req.session.prenume || '';
 /* if (!db) {
    res.status(500).send('Conexiunea la baza de date nu a fost inițializată.');
    return;
  }*/
  if(db){
  db.all('SELECT * FROM produse', [], (err, rows) => {
    if (err) {
      console.error(err.message);
      res.status(500).send('Eroare la obținerea produselor din baza de date');
      return;
    }

    const produse = rows; // Variabila produse va conține rândurile obținute din tabela produse

    res.render('index', { numeUtilizator, nume, prenume, produse });
  });
}
else{
  res.render('index', { numeUtilizator, nume, prenume});
}
});


 app.get('/autentificare', (req, res) => {
   const mesajEroare = req.cookies.mesajEroare || '';
 
   res.render('autentificare', { mesajEroare }); 
 });


app.post('/delogare', (req, res) => {
  // Clear the session data
  req.session.destroy(err => {
    if (err) {
      console.error(err);
    }
    res.redirect('/autentificare');
  });
});


app.post('/verificare-autentificare', (req, res) => {
  const { utilizator, parola } = req.body;

  fs.readFile('utilizatori.json', 'utf8', (err, data) => {
    if (err) {
      console.error(err);
      res.status(500).send('Eroare la citirea fișierului utilizatori.json');
      return;
    }

    const utilizatori = JSON.parse(data);

    // Check if the entered username and password match any user in the JSON file
    const authenticatedUser = utilizatori.find(
      user => user.utilizator === utilizator && user.parola === parola
    );

    if (authenticatedUser) {
      console.log('Autentificare reușită!');
      req.session.numeUtilizator = utilizator;
      req.session.nume = authenticatedUser.nume;
      req.session.prenume = authenticatedUser.prenume;
      req.session.tip=authenticatedUser.tip;
      console.log(req.session.tip);
      res.redirect('/index');
    } else {
      console.log('Utilizator sau parolă incorecte!');
      req.session.mesajEroare = 'Utilizator sau parolă incorecte!';
      res.redirect('/autentificare');
    }
  });
});

let db; 
app.get('/creare-bd', (req, res) => {
  db = new sqlite3.Database('./cumparaturi.db', (err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('Connected to the cumparaturi database.');
  });
  db.run('DROP TABLE IF EXISTS produse');
  db.run('CREATE TABLE IF NOT EXISTS produse(id INTEGER PRIMARY KEY, nume TEXT, pret INTEGER NOT NULL)');
  res.redirect('/');
});
app.get('/inserare-bd', (req, res) => {
  // Verificați dacă baza de date a fost creată și conectați-vă la ea
  if (db) {
    // produsele pe care vreau sa le inserez in tabela produse
    const produse = [
      { nume: 'rama metalica', pret: 20 },
      { nume: 'card de memorie', pret: 20 },
      { nume: 'Echipament de iluminare', pret: 800 }
      
    ];
   
    produse.forEach((produs) => {
      const { nume, pret } = produs;
      // Folosiți metoda `db.run` pentru a insera un produs în tabela produse
      db.run('INSERT INTO produse (nume, pret) VALUES (?, ?)', [nume, pret], function(err) {
        if (err) {
          console.error(err.message);
        }
        console.log(`Produsul cu ID-ul ${this.lastID} a fost inserat în tabela produse.`);
      });
    });

   
    res.redirect('/');
  } else {
    res.status(500).send('Baza de date nu a fost creată încă.');
  }
});

app.post('/adaugare_cos', function(req, res) {
  const produsId = req.body.produsId; // id-ul produsului primit prin POST
  console.log(produsId);
  req.session.cosCumparaturi  = req.session.cosCumparaturi  || []; // inițializăm vectorul de cos, dacă nu există deja

  // Verificăm dacă produsul se află deja în coș
  const produsExistent = req.session.cosCumparaturi .find(function(produs) {
      return produs.id === produsId;
  });

  if (produsExistent) {
      // Actualizăm cantitatea produsului existent
      produsExistent.cantitate++;
  } else {
      // Adăugăm un nou produs în coș
      req.session.cosCumparaturi.push({
          id: produsId,
          cantitate: 1
      });
  }
  res.redirect('/'); // redirecționăm utilizatorul înapoi la pagina principală
});

app.get('/vizualizare-cos', function(req, res) {
    const utilizator = req.session.utilizator;
    var cosCumparaturi = req.session.cosCumparaturi || [];

    if (cosCumparaturi.length > 0) {
        const db = new sqlite3.Database('./cumparaturi.db', (err) => {
            if (err) {
                console.error(err.message);
                res.status(500).send('Eroare la conectarea la baza de date');
                return;
            }

            var placeholders = cosCumparaturi.map(function(produs) {
                return '?';
            }).join(',');
            var values = cosCumparaturi.map(function(produs) {
                return produs.id;
            });
            var sql = 'SELECT * FROM produse WHERE id IN (' + placeholders + ')';

            db.all(sql, values, function(err, rows) {
                if (err) {
                    console.error(err.message);
                    res.status(500).send('Eroare la obținerea produselor din baza de date');
                    return;
                }

      
                var produseCos = rows.map(function(produs) {
                    var produsCos = cosCumparaturi.find(function(item) {
                        return item.id == produs.id;
                    });

                    produs.cantitate = produsCos ? produsCos.cantitate : 0;
                    produsCos.nume=produs.nume;
                    produsCos.pret=produs.pret;
                    return produs;
                });
                console.log(cosCumparaturi);
                res.render('vizualizare-cos', {
                    utilizator: utilizator,
                    tip: req.session.tip,
                    layout: 'layout',
                    cosProduse: cosCumparaturi
                });
                
                db.close(); 
            });
        });
    } else {
        res.render('vizualizare-cos', {
            utilizator: utilizator,
            tip: req.session.tip,
            layout: 'layout',
            cosProduse: []
        });
    }
});


app.get('/admin',(req,res)=>{
  console.log(req.session.tip);
  const utilizator = req.session.utilizator;
  if(req.session.tip==='ADMIN'){
    res.render('admin', {
      utilizator: utilizator,
      tip: req.session.tip,
      layout: 'layout',
  });
  }
  else{
    res.status(403).send('Acces interzis!');
  }
});
app.post('/adauga-produs', function(req, res) {
  const id = req.body.id;
  const nume = req.body.nume;
  const pret = req.body.pret;

  // Deschideți conexiunea cu baza de date
  const db = new sqlite3.Database('cumparaturi.db');

  // Definește o instrucțiune SQL cu placeholder-e pentru adăugarea produsului în tabela "produse"
  const sql = 'INSERT INTO produse (id, nume, pret) VALUES (?, ?, ?)';

  db.run(sql, [id, nume, pret], function(err) {
    if (err) {
      console.error(err.message);
     
      res.status(500).send('Eroare la adăugarea produsului în baza de date');
    } else {
      // Produsul a fost adăugat cu succes în baza de date
      res.redirect('/');
    }
    
    db.close();
  });
});
app.all('*',(req,res)=>{
  const clientIP = req.ip; // Obținem adresa IP a clientului
  ipAccessCount[clientIP] = (ipAccessCount[clientIP] || 0) + 1;
  if (ipAccessCount[clientIP] >= 4) {
    // Dacă IP-ul a accesat deja cel puțin 4 resurse inexistente, blocam IP-ul pentru 8 secunde
    const blockDuration = 8 * 1000; // 8 secunde exprimate în milisecunde
    blockedIPs[clientIP] = Date.now() + blockDuration;
    console.log(`IP-ul ${clientIP} a fost blocat pentru 8 secunde`);
  }
  res.status(404).send('Pagina nu a fost găsită.');
});
app.listen(port, () => console.log(`Serverul rulează la adresa http://localhost:`));
