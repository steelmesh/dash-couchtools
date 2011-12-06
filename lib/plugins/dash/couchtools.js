var debug = require('debug')('dash-couchtools'),
    path = require('path'),
    replimate = require('replimate'),
    request = require('request'),
    viewsPath = path.resolve(__dirname, '../../views'),
    _couchurl;
    
function _addReplicationRule(req, res, next) {
    var from = req.param('sourcedb'),
        to = req.param('localdb'),
        continuous = req.param('continuous');
        
    debug('replication rule requested, from: ' + from + ', to: ' + to);
    if (from && to) {
        replimate(_couchurl, {
            action: 'replicate',
            source: from,
            target: to,
            continuous: continuous ? true : false
        }, function(err) {
            res.redirect('/replication');
        });
    }
    // pass control back
    else {
        res.redirect('/replication/add');
    }
} // _addReplicationRule
    
function _clearCompleted(req, res) {
    replimate(_couchurl, { action: 'clear-completed' }, function(err) {
        res.redirect('/replication');
    });
} // _clearCompleted

function _deleteJob(req, res) {
    var targetDoc = _couchurl + '/_replicator/' + req.param('id') + '?rev=' + req.param('rev');
    
    request.del(targetDoc, function(err, delRes, body) {
        debug('DELETE: ' + targetDoc, body);
        if (err) {
            req.message(err, 'error');
        } 
        
        res.redirect('/replication');
    });
} // _deleteJob

function _getJobs(req, page, callback) {
    replimate(_couchurl, function(err, data) {
        callback({ docs: data || [] });        
    });
} // _getJobs

exports.connect = function(server, config, dash, callback) {
    var couchNav = [
        { url: '/replication', title: 'Replication' }
    ];
    
    _couchurl = (config.admin ? config.admin.couchurl : null) || config.couchurl;
    
    server.get('/replication/clear_completed', _clearCompleted);
    server.post('/replication/addrule', _addReplicationRule);
    server.get('/replication/delete/:id', _deleteJob);
    
    callback({
        loaders: {
            replication: _getJobs
        },
        
        nav: [
            { url: '/couch', title: 'CouchDB', items: couchNav }
        ],
        
        views: {
            replication: path.join(viewsPath, 'replication.html'),
            'replication/add': path.join(viewsPath, 'replication/add.html')
        }
    });
};

exports.drop = function(server, config) {
    server.remove('/replication/clear_completed');
    server.remove('/replication/add');
    server.remove('/replication/delete/:id');
    
    return [
        { action: 'dropLoader', loader: 'replication' },
        { action: 'removeNav', url: '/couch' },
        { action: 'dropView', view: 'replication' },
        { action: 'dropView', view: 'replication/add' }
    ];
};