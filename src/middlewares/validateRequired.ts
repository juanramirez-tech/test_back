import { Request, Response, NextFunction } from 'express';

const validateRequired = (requiredFields: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const missingFields = requiredFields.filter(field => {
            const valueFromBody = req.body[field];
            const valueFromFiles = req.files && (req.files as any)[field];
            return (
                (valueFromBody === undefined || valueFromBody === null || valueFromBody === '') &&
                (valueFromFiles === undefined || valueFromFiles === null || valueFromFiles.length === 0)
            );
        });

        if (missingFields.length > 0) {
            return res.status(400).json({
                error: 'Missing required fields',
                fields: missingFields,
            });
        }

        next();
    };
};

export default validateRequired;