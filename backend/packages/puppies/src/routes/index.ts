import {Router} from 'express';
import puppiesRouter from './puppies';
import applicationsRouter from './applications';
import notificationsRouter from './notifications';

const router = Router();

router.use('/puppies', puppiesRouter);
router.use('/applications', applicationsRouter);
router.use('/notifications', notificationsRouter);

export default router;
