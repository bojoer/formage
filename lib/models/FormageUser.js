"use strict";
var Promise = require('mpromise'),
    UserForm = require('../forms/UserForm');


module.exports = function (mongoose) {
    var actions = ['view', 'delete', 'create', 'update', 'order'];

    var toName = function (modelName, action) {
        return modelName + '_' + action;
    };

    var schema = new mongoose.Schema({
        username: {type: String, required: true, unique: true},
        passwordHash: {type: String, editable: false},
        is_superuser: {type: Boolean, 'default': false},
        permissions: [
            { type: String, 'enum': [] }
        ],
        lastVisit: {type: Date, 'default': Date.now, editable: false}
    }, {strict: true});


    // **** Methods ****
    schema.methods.toSessionStore = function () {
        if (this.doubleHash) return this.doubleHash;
        return String(this.id);
    };

    schema.methods.hasPermissions = function (modelName, action) {
        return this.is_superuser || ~this.permissions.indexOf(toName(modelName, action));
    };


    // **** Statics ****
    schema.statics.fromSessionStore = function (sessionStore) {
        if (module.superUser.doubleHash === sessionStore) return Promise.fulfilled(module.superUser);
        return this.findById(sessionStore).exec();
    };


    schema.registerModelPermissions = function (modelName, permissions) {
        if (!permissions) permissions = actions;
        permissions.forEach(function (permission) {
            schema.paths.permissions.caster.options.enum.push(toName(modelName, permission));
            schema.tree.permissions[0].enum = schema.paths.permissions.caster.options.enum;
        });
    };


    schema.statics.setupSuperuser = function (username, password) {
        var vanilla = new this({username: username, passwordHash: UserForm.encryptSync(password), is_superuser: true});
        vanilla.doubleHash = UserForm.encryptSync(username+password+username+password);
        module.superUser = vanilla;
    };


    schema.statics.getByUsernamePassword = function (username, password, callback) {
        if (username === module.superUser.username && UserForm.compareSync(password, module.superUser.passwordHash)) {
            callback(module.superUser);
            return;
        }

        this.findOne({'username': username}, function (err, admin_user) {
            if (err) throw err;
            if (!admin_user) return callback();
            if (!UserForm.compareSync(password, admin_user.passwordHash)) return callback();
            // update last visit out-of-band
            admin_user.lastVisit = new Date();
            admin_user.save(function (err) {
                if (err) console.error('error updating admin user', err);
            });
            return callback(admin_user);
        });
    };


    schema.formage = {
        section: 'Administration',
        form: UserForm,
        list: ['username'],
        order_by: ['username']
    };

    return schema;
};
