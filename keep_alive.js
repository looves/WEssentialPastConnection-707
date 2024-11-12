var http = require('http');

http.createServer(function (req, res) {
    res.write("Wonho is on!"); // Escribiendo en la respuesta
    res.end('Ready to play cards'); // Enviando la respuesta y finalizando
}).listen(8080);
