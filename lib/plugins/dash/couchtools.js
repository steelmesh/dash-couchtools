var async = require('async'),
    debug = require('debug')('dash-couchtools'),
    path = require('path'),
    replimate = require('replimate'),
    request = require('request'),
    nano = require('nano'),
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

function _getDatabases(config, dash) {
    var databases = [],
        couch = nano(dash.couchurl);
    
    function dbInfo(dbname, itemCallback) {
        if (dbname && dbname[0] === '_') {
            itemCallback();
            return;
        }
        
        couch.db.get(dbname, function(err, data) {
            if (! err) {
                // parse the instance start time
                data.start_time = new Date(parseInt(data.instance_start_time, 10));
                databases.push(data);
            }
            
            itemCallback(err);
        });
    } // dbInfo
    
    return function(req, page, callback) {
        // clear the list of databases
        databases = [];
        
        couch.db.list(function(err, data) {
            debug('getting couch database list, err = ', err);
            if (! err) {
                async.forEach(data, dbInfo, function(err) {
                    callback({
                        databases: databases
                    });
                });
            }
        });
    };
}

function _getJobs(req, page, callback) {
    replimate(_couchurl, function(err, data) {
        callback({ docs: data || [] });        
    });
} // _getJobs

function _getStatus(config, dash) {
    return function(req, page, callback) {
        callback({});
    };
}

exports.connect = function(server, config, dash, callback) {
    var couchNav = [
        { url: '/couch/list', title: 'Databases' },
        { url: '/couch/status', title: 'Status' },
        { url: '/replication', title: 'Replication' }
    ];
    
    _couchurl = (config.admin ? config.admin.couchurl : null) || config.couchurl;
    
    server.get('/replication/clear_completed', _clearCompleted);
    server.get('/replication/addrule', _addReplicationRule);
    server.get('/replication/delete/:id', _deleteJob);
    
    callback({
        loaders: {
            replication: _getJobs,
            'couch/list': _getDatabases(config, dash),
            'couch/status': _getStatus(config, dash)
        },
        
        nav: [
            { url: '/couch', title: 'CouchDB', items: couchNav }
        ],
        
        views: {
            replication: path.join(viewsPath, 'replication.html'),
            'replication/add': path.join(viewsPath, 'replication/add.html'),
            'couch/list': path.join(viewsPath, 'list.html'),
            'couch/status': path.join(viewsPath, 'status.html')
        }
    });
};

exports.drop = function(server, config) {
    server.remove('/replication/clear_completed');
    server.remove('/replication/add');
    server.remove('/replication/delete/:id');
    
    return [
        { action: 'dropLoader', loader: 'replication' },
        { action: 'dropLoader', loader: 'couch/list' },
        { action: 'dropLoader', loader: 'couch/status' },
        { action: 'removeNav', url: '/couch' },
        { action: 'dropView', view: 'couch/list' },
        { action: 'dropView', view: 'couch/status' },
        { action: 'dropView', view: 'replication' },
        { action: 'dropView', view: 'replication/add' }
    ];
};