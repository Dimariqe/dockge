import { BeanModel } from "redbean-node/dist/bean-model";

/**
 * status:
 * 0 = Pending
 * 1 = Valid
 * 2 = Error
 */
class ImageCache extends BeanModel {

    /**
     * Return an object that ready to parse to JSON for public
     * Only show necessary data to public
     * @returns {object}
     */
    toPublicJSON() {
        return {
            id: this.id,
            imageName: this.image_name,
            digest: this.digest,
            lastChecked: this.last_checked,
            status: this.status,
        };
    }

    /**
     * Return an object that ready to parse to JSON
     * @returns {object}
     */
    toJSON() {
        return this.toPublicJSON();
    }
}

export default ImageCache;
