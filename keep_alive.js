var http = require('http');

http.createServer(function (req, res) {
    res.write("Wonho is ready!"); // Escribiendo en la respuesta
    res.end(' responding to commands...'); // Enviando la respuesta y finalizando
}).listen(8081);
