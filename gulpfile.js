'use strict';

const gulp = require('gulp'),
    rimraf = require('rimraf'),//удаление файлов
    mainfiles = require('main-bower-files'),//переопределение основных файлов Bower
    pug = require('gulp-pug'),//плагин компиляции pug
    sass = require('gulp-sass'),//плагин компиляции scss
    prefixer = require('gulp-autoprefixer'),//плагин расстановки префиксов
    concat = require('gulp-concat'),//плагин конкатенации
    uglify = require('gulp-uglify'),//плагин сжатия js
    sourcemaps = require('gulp-sourcemaps'),//плагин создания map-файлов
    rigger = require('gulp-rigger'),
    browserSync = require("browser-sync"),
    reload = browserSync.reload,
    sftp = require('gulp-sftp'),//работа с SFTP
    git = require('gulp-git'),//работа с git
    imagemin = require('gulp-imagemin'),
    pngquant = require('imagemin-pngquant'),
    //утилиты
    rename = require('gulp-rename'),
    newer =require('gulp-newer'),
    filter = require('gulp-filter'),
    //отладка
    debug = require('gulp-debug'),
    notify = require('gulp-notify'),
    //watch = require('gulp-watch'),
    //argv = require('yargs').argv,
    fs = require('fs');// работа с файловой системой

/* Variables essential for executing  main tasks in the project */

var path = {
        build: { // пути для сборки проектов
            all:'build/',
            pug: 'build/',
            js: 'build/js/',
            scss: 'build/css/',
            img: 'build/img/',
            fonts: 'build/fonts/'
        },
        src: { // пути размещения исходных файлов проекта
            pug: 'src/index.{pug,jade}',
            js: 'src/js/main.js',
            scss: 'src/scss/main.scss',
            img: 'src/img/**/*.*',
            fonts: 'src/fonts/**/*.*'
        },
        watch: { // пути файлов, за изменением которых мы хотим наблюдать
            pug: 'src/**/*.pug',
            js: 'src/js/**/*.js',
            scss: 'src/scss/**/*.scss',
            img: 'src/img/**/*.*'
        },
        filter:{ // выражения для фильтрации файлов
                fonts:'**/*.{ttf,otf,woff,woff2,eot,svg}'
        },
        clean: './build', // путь очистки директории для сборки
        git:{
            files:['./*.*','./src/*'],
            remote:'https://valtuchkevich@bitbucket.org/valtuchkevich/wakewinch.git',
            branch:'master'
        }
},

site = {
        server:"",
        user:"",
        pass:"",
        port:"",
        folder:""
},

config = {
        server: {
            baseDir: "./build"
        },
        tunnel: true,
        host: 'localhost',
        port: 7787,
        logPrefix: "WebDev"
};

/* Main tasks for compilation and moving files */

gulp.task('clean', function(done){
    rimraf(path.clean, done);
});

gulp.task('build:fonts', function(done) {
    gulp.src(mainfiles([path.filter.fonts],{
        overrides:{
            "bootstrap-sass":{
                main:['./assets/fonts/bootstrap/*.*']
            },
            "font-awesome":{
                main:['./fonts/*.*']

            }
        }
    })).pipe(gulp.dest(path.build.fonts));
    done();
});

gulp.task('build:pug',function(done){
    gulp.src(path.src.pug)
        .pipe(pug({
            pretty:true
        }))
        .pipe(gulp.dest(path.build.all));
    done();
});


gulp.task('build:scss',function(done){
    gulp.src(path.src.scss)
        .pipe(sourcemaps.init())
        .pipe(sass({
            outputStyle:"compressed",
            sourcemaps:true
        }))
        .pipe(prefixer({
            cascade:false,
            browsers: ['last 5 versions'],
            remove:true
        }))
        .pipe(sourcemaps.write('.'))
        .pipe(gulp.dest(path.build.scss))
        .pipe(reload({stream: true})); //И перезагрузим сервер
    done();
});

gulp.task('build:js', function (done) {
    gulp.src(path.src.js) //main файл
        .pipe(rigger()) // rigger
        .pipe(sourcemaps.init()) //Инициализируем sourcemap
        .pipe(uglify()) //сжатие js
        .pipe(sourcemaps.write('.')) //Пропишем карты
        .pipe(gulp.dest(path.build.js)) // готовый файл в build
        .pipe(reload({stream: true})); //И перезагрузим сервер
    done();
});


//TODO: Check build:img

gulp.task('build:img', function (done) {
    gulp.src(path.src.img) //Выберем наши картинки
        .pipe(imagemin({ //Сожмем их
            progressive: true,
            svgoPlugins: [{removeViewBox: false}],
            use: [pngquant()],
            interlaced: true
        }))
        .pipe(gulp.dest(path.build.img)) //И бросим в build
        .pipe(reload({stream: true}));
    done();
});

gulp.task('mv:img',function(done){
    gulp.src(path.src.img)
        .pipe(gulp.dest(path.build.img))
        .pipe(reload({stream: true}));
    done();
});


gulp.task('webserver', function (done) {
    browserSync(config);
    done();
});

/* Deploy git tasks */

// git init в случае, если нет репозитория
gulp.task('git:init', function(){
    git.init(function (err) {
        if (err) throw err;
    });
});

// git remote add в случае, если нет remote
gulp.task('git:remoteadd', function(done){
    git.addRemote('origin', path.git.remote, function (err) {
        if (err) throw err;
    });
    done();
});

/* Main git tasks */

gulp.task('git:status', function(done){
    git.status({}, function (err, stdout) {
        if (err) throw err;
    });
    done();
});

gulp.task('git:pull', function(done){
    git.pull('origin', ['master', 'develop'], function (err) {
        if (err) throw err;
    });
    done();
});

gulp.task('git:add', function(done) {
    console.log('Staging files ...');
    gulp.src(path.git.files)
        .pipe(git.add());
    done();
});

gulp.task('git:rm', function(){
    return gulp.src('./build')
        .pipe(git.rm());
});

gulp.task('git:commit', function(done){
    gulp.src(path.git.files)
        .pipe(git.commit('initial gulp commit'));
    done();
});

gulp.task('git:push', function(done){
    console.log('pushing...');
    git.push('origin', path.git.branch, function (err) {
        if (err) throw err;
    });
    done();
});

/* SFTP */

gulp.task('sftp:push', function (done) {
    gulp.src(path.build.all)
        .pipe(sftp({
            host: site.server,
            user: site.user,
            pass: site.pass,
            port: site.port,
            remotePath:site.folder
        }));
    done();
});

/* Watcher */
gulp.task('watch',function (done) {
    gulp.watch(path.watch.pug, gulp.series('build:pug'));
    gulp.watch(path.watch.scss, gulp.series('build:scss'));
    gulp.watch(path.watch.fonts, gulp.series('build:fonts'));
    gulp.watch(path.watch.js, gulp.series('build:js'));
    gulp.watch(path.watch.img, gulp.series('build:img'));
    done();
});

/* Execution */

gulp.task('git:execute', gulp.series('git:status','git:add','git:commit','git:push'));

gulp.task('build', gulp.series('clean', gulp.parallel('build:fonts','build:pug','mv:img','build:js','build:scss')));

gulp.task('default', gulp.series('build','webserver','watch'));