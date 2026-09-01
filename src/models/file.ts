import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';
import { FileMetadata, FileVariants } from '../storage';
import { buildSignedMediaUrl, mediaPathForStoredFile } from '../utils/mediaUrl';

/**
 * Información de archivo almacenado localmente
 */
export interface LocalFileInfo {
    fieldname: string;
    originalname: string;
    storedName: string;
    encoding: string;
    mimetype: string;
    size: number;
    hash: string;
    path: string;
    category: 'image' | 'document' | 'other';
    metadata?: FileMetadata;
    variants?: FileVariants;
}

/**
 * Atributos del modelo File
 */
export interface FileAttributes {
    id: number;
    name: string;
    mainFile?: LocalFileInfo | null;
    additionalFiles?: LocalFileInfo[];
    createdAt?: Date;
    updatedAt?: Date;
}

interface FileCreationAttributes extends Optional<FileAttributes, 'id'> { }

class File extends Model<FileAttributes, FileCreationAttributes> implements FileAttributes {
    public id!: number;
    public name!: string;
    public mainFile!: LocalFileInfo | null;
    public additionalFiles!: LocalFileInfo[];
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;

    /**
     * Obtiene la URL del archivo principal
     */
    public getMainFileUrl(): string | null {
        if (!this.mainFile) return null;
        return buildSignedMediaUrl(mediaPathForStoredFile(this.mainFile.storedName, this.mainFile.category));
    }

    public getMainFileThumbnailUrl(): string | null {
        if (!this.mainFile || this.mainFile.category !== 'image') return null;
        if (!this.mainFile.variants?.thumbnail) return null;
        return buildSignedMediaUrl(
            mediaPathForStoredFile(this.mainFile.variants.thumbnail, 'image', 'thumbnail')
        );
    }

    public getMainFileOptimizedUrl(): string | null {
        if (!this.mainFile || this.mainFile.category !== 'image') return null;
        if (!this.mainFile.variants?.optimized) return null;
        return buildSignedMediaUrl(
            mediaPathForStoredFile(this.mainFile.variants.optimized, 'image', 'optimized')
        );
    }

    public getAdditionalFileUrls(): string[] {
        if (!this.additionalFiles || !this.additionalFiles.length) return [];
        return this.additionalFiles.map((file) =>
            buildSignedMediaUrl(mediaPathForStoredFile(file.storedName, file.category))
        );
    }

    /**
     * Obtiene información completa con URLs
     */
    public toJSONWithUrls(): any {
        const json = this.toJSON();
        
        return {
            ...json,
            mainFile: this.mainFile ? {
                ...this.mainFile,
                url: this.getMainFileUrl(),
                thumbnailUrl: this.getMainFileThumbnailUrl(),
                optimizedUrl: this.getMainFileOptimizedUrl()
            } : null,
            additionalFiles: this.additionalFiles?.map((file) => {
                let thumbnailUrl: string | null = null;
                let optimizedUrl: string | null = null;
                const url = buildSignedMediaUrl(mediaPathForStoredFile(file.storedName, file.category));

                if (file.category === 'image') {
                    if (file.variants?.thumbnail) {
                        thumbnailUrl = buildSignedMediaUrl(
                            mediaPathForStoredFile(file.variants.thumbnail, 'image', 'thumbnail')
                        );
                    }
                    if (file.variants?.optimized) {
                        optimizedUrl = buildSignedMediaUrl(
                            mediaPathForStoredFile(file.variants.optimized, 'image', 'optimized')
                        );
                    }
                }

                return {
                    ...file,
                    url,
                    thumbnailUrl,
                    optimizedUrl
                };
            }) || []
        };
    }
}

File.init(
    {
        id: {
            type: DataTypes.BIGINT,
            autoIncrement: true,
            primaryKey: true,
        },
        name: {
            type: DataTypes.STRING(128),
            allowNull: false,
            validate: {
                notEmpty: true
            }
        },
        mainFile: {
            type: DataTypes.JSON,
            allowNull: true,
        },
        additionalFiles: {
            type: DataTypes.JSON,
            allowNull: true,
            defaultValue: []
        }
    },
    {
        tableName: 'files',
        sequelize,
    }
);

export default File;
