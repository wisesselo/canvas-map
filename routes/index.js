import { Router } from 'express';
var router = Router();

// Get the index page and render it
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

export default router;
